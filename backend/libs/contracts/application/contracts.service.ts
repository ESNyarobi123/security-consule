import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractStatus,
  InvoiceStatus,
  NotificationChannel,
  type Contract,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import { NotificationsService } from '@pssms/notifications';
import {
  CONTRACT_SERVICE_TYPES,
  ContractResponseDto,
  CreateContractDto,
} from '../presentation/dto/contract.dto';

const CANONICAL_SERVICE = new Set<string>(CONTRACT_SERVICE_TYPES);

/** Operational status changes only — approval path uses submit/approve/reject. */
const STATUS_TRANSITIONS: Partial<
  Record<ContractStatus, ContractStatus[]>
> = {
  [ContractStatus.APPROVED]: [ContractStatus.ACTIVE, ContractStatus.CANCELLED],
  [ContractStatus.ACTIVE]: [
    ContractStatus.TERMINATED,
    ContractStatus.EXPIRING,
  ],
  [ContractStatus.EXPIRING]: [
    ContractStatus.ACTIVE,
    ContractStatus.TERMINATED,
  ],
};

type SiteSummary = { id: string; code: string; name: string };

export type ContractScanExpiringResult = {
  scannedAt: string;
  daysAhead: number;
  markedExpiring: number;
  notificationsQueued: number;
  contracts: Array<{
    id: string;
    contractNumber: string;
    customerId: string;
    endDate: Date;
    status: ContractStatus;
  }>;
};

export type ContractCommercialAlertsDto = {
  expiring: ContractResponseDto[];
  unpaidByCustomer: Array<{
    customerId: string;
    customerCode: string;
    customerName: string;
    openInvoiceCount: number;
    openBalance: string;
    currency: string;
    hasExpiringContract: boolean;
  }>;
};

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly approvals: ApprovalsService,
  ) {}

  async create(
    dto: CreateContractDto,
    user: AuthUser,
  ): Promise<ContractResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: user.organizationId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const exists = await this.prisma.contract.findFirst({
      where: {
        organizationId: user.organizationId,
        contractNumber: dto.contractNumber,
      },
    });
    if (exists) throw new ConflictException('Contract number already exists');

    const serviceTypes = this.resolveServiceTypes(dto);
    const serviceType = serviceTypes[0]!;
    const siteIds =
      dto.siteIds !== undefined ? [...new Set(dto.siteIds)] : [];

    if (dto.siteIds !== undefined) {
      await this.validateCustomerSites(
        user.organizationId,
        dto.customerId,
        siteIds,
      );
    }

    if (dto.renewalDate) {
      const renewal = new Date(dto.renewalDate);
      const start = new Date(dto.startDate);
      renewal.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      if (renewal < start) {
        throw new BadRequestException(
          'renewalDate must be on or after startDate',
        );
      }
    }

    const contract = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({
        data: {
          organizationId: user.organizationId,
          customerId: dto.customerId,
          contractNumber: dto.contractNumber,
          title: dto.title,
          serviceType,
          serviceTypes,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          monthlyFee: dto.monthlyFee,
          currency: dto.currency ?? 'TZS',
          paymentTerms: dto.paymentTerms ?? null,
          contractKind: dto.contractKind ?? 'NEW',
          renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
          noticePeriodDays: dto.noticePeriodDays ?? 30,
          invoiceFrequency: dto.invoiceFrequency ?? 'MONTHLY',
          vatApplicable: dto.vatApplicable ?? true,
          slaLevel: dto.slaLevel ?? 'STANDARD',
          guardCount: dto.guardCount,
          slaTerms: dto.slaTerms,
          status: ContractStatus.DRAFT,
          createdBy: user.id,
        },
      });

      if (siteIds.length > 0) {
        await tx.contractSite.createMany({
          data: siteIds.map((siteId) => ({
            organizationId: user.organizationId,
            contractId: created.id,
            siteId,
          })),
        });
      }

      return created;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'contract.created',
      resourceType: 'Contract',
      resourceId: contract.id,
      after: { ...contract, siteCount: siteIds.length, siteIds },
    });

    return this.toDtoEnriched(contract);
  }

  /** Prefer serviceTypes[]; fall back to legacy single serviceType. */
  private resolveServiceTypes(dto: CreateContractDto): string[] {
    const fromArray = (dto.serviceTypes ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
    const fromLegacy = dto.serviceType?.trim()
      ? [dto.serviceType.trim()]
      : [];
    const raw = fromArray.length > 0 ? fromArray : fromLegacy;
    if (raw.length === 0) {
      throw new BadRequestException(
        'Provide serviceTypes (min 1) or legacy serviceType',
      );
    }
    const unique = [...new Set(raw)];
    const invalid = unique.filter((s) => !CANONICAL_SERVICE.has(s));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid service type(s): ${invalid.join(', ')}`,
      );
    }
    return unique;
  }

  /**
   * Replace bound sites on a DRAFT contract only (avoids silently changing
   * active commercial coverage).
   */
  async setSites(
    id: string,
    siteIds: string[],
    user: AuthUser,
  ): Promise<ContractResponseDto> {
    const existing = await this.findOrThrow(id, user.organizationId);
    if (existing.status !== ContractStatus.DRAFT) {
      throw new BadRequestException(
        'Sites can only be replaced while the contract is DRAFT',
      );
    }

    const unique = [...new Set(siteIds)];
    await this.validateCustomerSites(
      user.organizationId,
      existing.customerId,
      unique,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.contractSite.deleteMany({
        where: { contractId: id, organizationId: user.organizationId },
      });
      if (unique.length > 0) {
        await tx.contractSite.createMany({
          data: unique.map((siteId) => ({
            organizationId: user.organizationId,
            contractId: id,
            siteId,
          })),
        });
      }
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'contract.sites.updated',
      resourceType: 'Contract',
      resourceId: id,
      after: { siteCount: unique.length, siteIds: unique },
    });

    return this.toDtoEnriched(existing);
  }

  async list(
    organizationId: string,
    customerId?: string,
  ): Promise<ContractResponseDto[]> {
    const rows = await this.prisma.contract.findMany({
      where: {
        organizationId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.toDtoList(rows, organizationId);
  }

  async updateStatus(
    id: string,
    status: ContractStatus,
    user: AuthUser,
  ): Promise<ContractResponseDto> {
    const existing = await this.findOrThrow(id, user.organizationId);
    const allowed = STATUS_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot move contract from ${existing.status} to ${status}. Use submit/approve for drafts.`,
      );
    }

    const updated = await this.prisma.contract.update({
      where: { id },
      data: { status, version: { increment: 1 } },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `contract.status.${status.toLowerCase()}`,
      resourceType: 'Contract',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.toDtoEnriched(updated);
  }

  async submit(id: string, user: AuthUser): Promise<ContractResponseDto> {
    const existing = await this.findOrThrow(id, user.organizationId);
    if (existing.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT contracts can be submitted');
    }

    const approval = await this.approvals.start(
      {
        workflowCode: 'contract-approval',
        resourceType: 'Contract',
        resourceId: existing.id,
        amount: Number(existing.monthlyFee),
      },
      user,
    );

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        status: ContractStatus.PENDING_APPROVAL,
        approvalInstanceId: approval.id,
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'contract.submitted',
      resourceType: 'Contract',
      resourceId: id,
      after: {
        status: updated.status,
        approvalInstanceId: approval.id,
      },
    });

    return this.toDtoEnriched(updated);
  }

  async approve(id: string, user: AuthUser): Promise<ContractResponseDto> {
    const existing = await this.findOrThrow(id, user.organizationId);
    if (existing.status !== ContractStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only PENDING_APPROVAL contracts can be approved',
      );
    }
    if (!existing.approvalInstanceId) {
      throw new BadRequestException('No approval instance on contract');
    }

    const approval = await this.approvals.act(
      existing.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    if (approval.status !== 'APPROVED') {
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'contract.approval_step',
        resourceType: 'Contract',
        resourceId: id,
        after: {
          approvalStatus: approval.status,
          currentStepOrder: approval.currentStepOrder,
          currentStepName: approval.currentStepName ?? null,
          requiredRole: approval.requiredRole ?? null,
        },
      });
      return this.toDtoEnriched(existing);
    }

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        status: ContractStatus.APPROVED,
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'contract.approved',
      resourceType: 'Contract',
      resourceId: id,
      before: { status: existing.status },
      after: { status: updated.status },
    });

    return this.toDtoEnriched(updated);
  }

  async reject(
    id: string,
    reason: string | undefined,
    user: AuthUser,
  ): Promise<ContractResponseDto> {
    const existing = await this.findOrThrow(id, user.organizationId);
    if (existing.status !== ContractStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only PENDING_APPROVAL contracts can be rejected',
      );
    }

    if (existing.approvalInstanceId) {
      await this.approvals.act(
        existing.approvalInstanceId,
        { decision: 'REJECT', remarks: reason },
        user,
      );
    }

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        status: ContractStatus.DRAFT,
        approvalInstanceId: null,
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'contract.rejected',
      resourceType: 'Contract',
      resourceId: id,
      after: { status: updated.status, reason: reason ?? null },
    });

    return this.toDtoEnriched(updated);
  }

  private async findOrThrow(id: string, organizationId: string) {
    const existing = await this.prisma.contract.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Contract not found');
    return existing;
  }

  /**
   * Ensure each site exists in the org and belongs to the contract customer.
   */
  private async validateCustomerSites(
    organizationId: string,
    customerId: string,
    siteIds: string[],
  ): Promise<void> {
    if (siteIds.length === 0) return;

    const sites = await this.prisma.site.findMany({
      where: {
        id: { in: siteIds },
        organizationId,
        customerId,
      },
      select: { id: true },
    });
    if (sites.length === siteIds.length) return;

    const found = new Set(sites.map((s) => s.id));
    const missing = siteIds.filter((id) => !found.has(id));
    throw new BadRequestException(
      `Site(s) not found for this customer/organization: ${missing.join(', ')}`,
    );
  }

  private async loadSitesByContract(
    organizationId: string,
    contractIds: string[],
  ): Promise<Map<string, SiteSummary[]>> {
    const result = new Map<string, SiteSummary[]>();
    for (const id of contractIds) result.set(id, []);
    if (contractIds.length === 0) return result;

    const links = await this.prisma.contractSite.findMany({
      where: { organizationId, contractId: { in: contractIds } },
      select: { contractId: true, siteId: true },
    });
    if (links.length === 0) return result;

    const siteIds = [...new Set(links.map((l) => l.siteId))];
    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds }, organizationId },
      select: { id: true, code: true, name: true },
    });
    const siteMap = new Map(sites.map((s) => [s.id, s]));

    for (const link of links) {
      const site = siteMap.get(link.siteId);
      if (!site) continue;
      const list = result.get(link.contractId) ?? [];
      list.push(site);
      result.set(link.contractId, list);
    }
    return result;
  }

  private async toDtoEnriched(c: Contract): Promise<ContractResponseDto> {
    const [dto] = await this.toDtoList([c], c.organizationId);
    return dto!;
  }

  private async toDtoList(
    rows: Contract[],
    organizationId: string,
  ): Promise<ContractResponseDto[]> {
    const sitesByContract = await this.loadSitesByContract(
      organizationId,
      rows.map((r) => r.id),
    );
    const approvalById = await this.loadApprovalsById(
      organizationId,
      rows
        .map((r) => r.approvalInstanceId)
        .filter((id): id is string => !!id),
    );
    return rows.map((c) =>
      this.toDto(
        c,
        sitesByContract.get(c.id) ?? [],
        c.approvalInstanceId
          ? approvalById.get(c.approvalInstanceId)
          : undefined,
      ),
    );
  }

  private async loadApprovalsById(
    organizationId: string,
    instanceIds: string[],
  ): Promise<
    Map<
      string,
      {
        status: string;
        currentStepOrder: number;
        currentStepName: string | null;
        requiredRole: string | null;
      }
    >
  > {
    const unique = [...new Set(instanceIds)];
    if (unique.length === 0) return new Map();

    const instances = await this.prisma.approvalInstance.findMany({
      where: { organizationId, id: { in: unique } },
      include: {
        version: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
    });

    const map = new Map<
      string,
      {
        status: string;
        currentStepOrder: number;
        currentStepName: string | null;
        requiredRole: string | null;
      }
    >();
    for (const inst of instances) {
      const step =
        inst.status === 'PENDING'
          ? inst.version.steps.find(
              (s) => s.stepOrder === inst.currentStepOrder,
            )
          : undefined;
      map.set(inst.id, {
        status: inst.status,
        currentStepOrder: inst.currentStepOrder,
        currentStepName: step?.name ?? null,
        requiredRole: step?.requiredRole ?? null,
      });
    }
    return map;
  }

  /**
   * Mark ACTIVE contracts with endDate within `daysAhead` as EXPIRING and
   * queue one EMAIL reminder per contract (idempotent by end date).
   */
  async scanExpiring(
    organizationId: string,
    actor: AuthUser,
    daysAhead = 90,
  ): Promise<ContractScanExpiringResult> {
    const horizon = new Date();
    horizon.setHours(23, 59, 59, 999);
    horizon.setDate(horizon.getDate() + daysAhead);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = await this.prisma.contract.findMany({
      where: {
        organizationId,
        status: ContractStatus.ACTIVE,
        endDate: { gte: today, lte: horizon },
      },
    });

    const customerIds = [...new Set(due.map((c) => c.customerId))];
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds }, organizationId },
      select: {
        id: true,
        code: true,
        name: true,
        billingEmail: true,
        email: true,
        opsEmail: true,
      },
    });
    const customerById = new Map(customers.map((c) => [c.id, c]));

    let markedExpiring = 0;
    let notificationsQueued = 0;
    const touched: ContractScanExpiringResult['contracts'] = [];

    for (const row of due) {
      const updated = await this.prisma.contract.update({
        where: { id: row.id },
        data: {
          status: ContractStatus.EXPIRING,
          version: { increment: 1 },
        },
      });
      markedExpiring += 1;
      touched.push({
        id: updated.id,
        contractNumber: updated.contractNumber,
        customerId: updated.customerId,
        endDate: updated.endDate,
        status: updated.status,
      });

      await this.audit.record({
        organizationId,
        actorId: actor.id,
        action: 'contract.status.expiring',
        resourceType: 'Contract',
        resourceId: updated.id,
        before: { status: row.status },
        after: {
          status: updated.status,
          endDate: updated.endDate,
          daysAhead,
        },
      });

      const customer = customerById.get(row.customerId);
      const recipient =
        customer?.billingEmail?.trim() ||
        customer?.opsEmail?.trim() ||
        customer?.email?.trim() ||
        null;
      if (!recipient) continue;

      const endKey = updated.endDate.toISOString().slice(0, 10);
      try {
        await this.notifications.enqueue(
          {
            channel: NotificationChannel.EMAIL,
            templateCode: 'CONTRACT_EXPIRING',
            recipient,
            subject: `Contract ${updated.contractNumber} expiring ${endKey}`,
            body: [
              `Hello ${customer?.name ?? 'Customer'},`,
              '',
              `Contract ${updated.contractNumber} (${updated.title}) is marked EXPIRING.`,
              `End date: ${endKey}`,
              `Service: ${updated.serviceType}`,
              '',
              'Please contact HIGHLINK to renew or adjust coverage before the end date.',
            ].join('\n'),
            resourceType: 'Contract',
            resourceId: updated.id,
            idempotencyKey: `contract-expiring-${updated.id}-${endKey}`,
          },
          actor,
        );
        notificationsQueued += 1;
      } catch {
        // Scan must succeed even if notification outbox is down / duplicate key
      }
    }

    return {
      scannedAt: new Date().toISOString(),
      daysAhead,
      markedExpiring,
      notificationsQueued,
      contracts: touched,
    };
  }

  async commercialAlerts(
    organizationId: string,
  ): Promise<ContractCommercialAlertsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in90 = new Date(today);
    in90.setDate(in90.getDate() + 90);

    const expiringRows = await this.prisma.contract.findMany({
      where: {
        organizationId,
        OR: [
          { status: ContractStatus.EXPIRING },
          {
            status: ContractStatus.ACTIVE,
            endDate: { gte: today, lte: in90 },
          },
        ],
      },
      orderBy: { endDate: 'asc' },
    });

    const openInvoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE,
          ],
        },
      },
      select: {
        customerId: true,
        totalAmount: true,
        amountPaid: true,
        currency: true,
      },
    });

    const byCustomer = new Map<
      string,
      { count: number; balance: number; currency: string }
    >();
    for (const inv of openInvoices) {
      const bal = Number(inv.totalAmount) - Number(inv.amountPaid);
      if (bal <= 0) continue;
      const cur = byCustomer.get(inv.customerId) ?? {
        count: 0,
        balance: 0,
        currency: inv.currency,
      };
      cur.count += 1;
      cur.balance += bal;
      byCustomer.set(inv.customerId, cur);
    }

    const customerIds = [...byCustomer.keys()];
    const customers =
      customerIds.length === 0
        ? []
        : await this.prisma.customer.findMany({
            where: { organizationId, id: { in: customerIds } },
            select: { id: true, code: true, name: true },
          });
    const custMap = new Map(customers.map((c) => [c.id, c]));
    const expiringCustomerIds = new Set(expiringRows.map((c) => c.customerId));

    const unpaidByCustomer = [...byCustomer.entries()]
      .map(([customerId, agg]) => {
        const c = custMap.get(customerId);
        return {
          customerId,
          customerCode: c?.code ?? '—',
          customerName: c?.name ?? '—',
          openInvoiceCount: agg.count,
          openBalance: agg.balance.toFixed(2),
          currency: agg.currency,
          hasExpiringContract: expiringCustomerIds.has(customerId),
        };
      })
      .sort((a, b) => Number(b.openBalance) - Number(a.openBalance));

    return {
      expiring: await this.toDtoList(expiringRows, organizationId),
      unpaidByCustomer,
    };
  }

  private toDto(
    c: Contract,
    sites: SiteSummary[],
    approval?: {
      status: string;
      currentStepOrder: number;
      currentStepName: string | null;
      requiredRole: string | null;
    },
  ): ContractResponseDto {
    const types =
      c.serviceTypes && c.serviceTypes.length > 0
        ? c.serviceTypes
        : c.serviceType
          ? [c.serviceType]
          : [];
    return {
      id: c.id,
      organizationId: c.organizationId,
      customerId: c.customerId,
      contractNumber: c.contractNumber,
      title: c.title,
      serviceType: c.serviceType || types[0] || '',
      serviceTypes: types,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      monthlyFee: c.monthlyFee.toString(),
      currency: c.currency,
      paymentTerms: c.paymentTerms ?? null,
      guardCount: c.guardCount,
      slaTerms: c.slaTerms,
      contractKind: c.contractKind,
      renewalDate: c.renewalDate ?? null,
      noticePeriodDays: c.noticePeriodDays,
      invoiceFrequency: c.invoiceFrequency ?? null,
      vatApplicable: c.vatApplicable,
      slaLevel: c.slaLevel ?? null,
      approvalInstanceId: c.approvalInstanceId ?? null,
      approvalStatus: approval?.status,
      approvalCurrentStepOrder: approval?.currentStepOrder,
      approvalCurrentStepName: approval?.currentStepName ?? null,
      approvalRequiredRole: approval?.requiredRole ?? null,
      siteIds: sites.map((s) => s.id),
      sites,
      createdAt: c.createdAt,
    };
  }
}
