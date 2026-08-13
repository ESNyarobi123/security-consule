import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractStatus,
  InvoiceStatus,
  NotificationChannel,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { NotificationsService } from '@pssms/notifications';
import {
  CreateInvoiceDto,
  DisputeInvoiceDto,
  INVOICE_SERVICE_TYPES,
  InvoiceAlertsPackDto,
  InvoiceResponseDto,
  InvoiceScanOverdueResultDto,
  RecordInvoicePaymentDto,
  VoidInvoiceDto,
} from '../presentation/dto/finance.dto';

const VOIDABLE: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.DISPUTED,
];

const DISPUTABLE: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

const BILLABLE_CONTRACT_STATUSES: ContractStatus[] = [
  ContractStatus.ACTIVE,
  ContractStatus.APPROVED,
  ContractStatus.EXPIRING,
];

const ALLOWED_SERVICE = new Set<string>(INVOICE_SERVICE_TYPES);

const SUSPENSION_GRACE_DAYS = 14;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateInvoiceDto, user: AuthUser): Promise<InvoiceResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: user.organizationId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    let contractNumber: string | null = null;
    let serviceType = this.normalizeServiceType(dto.serviceType);
    if (dto.contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: {
          id: dto.contractId,
          organizationId: user.organizationId,
          customerId: dto.customerId,
        },
        select: {
          id: true,
          contractNumber: true,
          status: true,
          serviceType: true,
        },
      });
      if (!contract) {
        throw new BadRequestException(
          'Contract not found for this customer / organisation',
        );
      }
      if (!BILLABLE_CONTRACT_STATUSES.includes(contract.status)) {
        throw new BadRequestException(
          `Contract ${contract.contractNumber} must be APPROVED, ACTIVE, or EXPIRING to invoice (now ${contract.status})`,
        );
      }
      contractNumber = contract.contractNumber;
      if (!serviceType && contract.serviceType) {
        serviceType =
          this.normalizeServiceType(contract.serviceType, false) ?? 'OTHER';
      }
    }
    if (!serviceType) serviceType = 'OTHER';

    const exists = await this.prisma.invoice.findFirst({
      where: {
        organizationId: user.organizationId,
        invoiceNumber: dto.invoiceNumber,
      },
    });
    if (exists) throw new BadRequestException('Invoice number already exists');

    let subtotal = new Prisma.Decimal(0);
    const lineData = dto.lines.map((l) => {
      const amount = new Prisma.Decimal(l.quantity * l.unitPrice);
      subtotal = subtotal.add(amount);
      return {
        description: l.description,
        quantity: new Prisma.Decimal(l.quantity),
        unitPrice: new Prisma.Decimal(l.unitPrice),
        amount,
      };
    });

    const taxAmount = new Prisma.Decimal(dto.taxAmount ?? 0);
    const totalAmount = subtotal.add(taxAmount);

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: user.organizationId,
        customerId: dto.customerId,
        contractId: dto.contractId ?? null,
        invoiceNumber: dto.invoiceNumber,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        subtotal,
        taxAmount,
        totalAmount,
        currency: dto.currency ?? 'TZS',
        serviceType,
        notes: dto.notes,
        createdBy: user.id,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'invoice.created',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      after: {
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        contractId: invoice.contractId,
        contractNumber,
        serviceType,
      },
    });

    return this.toDto(invoice, contractNumber);
  }

  async list(
    organizationId: string,
    customerId?: string,
    contractId?: string,
  ): Promise<InvoiceResponseDto[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        ...(customerId ? { customerId } : {}),
        ...(contractId ? { contractId } : {}),
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const contractIds = [
      ...new Set(
        rows.map((r) => r.contractId).filter((id): id is string => !!id),
      ),
    ];
    const contracts =
      contractIds.length === 0
        ? []
        : await this.prisma.contract.findMany({
            where: { id: { in: contractIds }, organizationId },
            select: { id: true, contractNumber: true, serviceType: true },
          });
    const numById = new Map(contracts.map((c) => [c.id, c.contractNumber]));
    const typeById = new Map(contracts.map((c) => [c.id, c.serviceType]));
    return rows.map((i) =>
      this.toDto(
        i,
        i.contractId ? (numById.get(i.contractId) ?? null) : null,
        i.serviceType ??
          (i.contractId ? (typeById.get(i.contractId) ?? null) : null),
      ),
    );
  }

  /**
   * Thin payment snapshot for other modules (e.g. parking permits) —
   * no cross-module Prisma access to finance tables.
   */
  async paymentSummaries(
    organizationId: string,
    invoiceIds: Array<string | null | undefined>,
  ): Promise<
    Map<
      string,
      {
        invoiceNumber: string;
        status: InvoiceStatus;
        totalAmount: number;
        amountPaid: number;
        balanceDue: number;
      }
    >
  > {
    const ids = [
      ...new Set(invoiceIds.filter((id): id is string => !!id)),
    ];
    const map = new Map<
      string,
      {
        invoiceNumber: string;
        status: InvoiceStatus;
        totalAmount: number;
        amountPaid: number;
        balanceDue: number;
      }
    >();
    if (!ids.length) return map;
    const rows = await this.prisma.invoice.findMany({
      where: { organizationId, id: { in: ids } },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        amountPaid: true,
      },
    });
    for (const row of rows) {
      const total = Number(row.totalAmount);
      const paid = Number(row.amountPaid);
      map.set(row.id, {
        invoiceNumber: row.invoiceNumber,
        status: row.status,
        totalAmount: total,
        amountPaid: paid,
        balanceDue: Math.max(0, total - paid),
      });
    }
    return map;
  }

  async send(id: string, user: AuthUser): Promise<InvoiceResponseDto> {
    const invoice = await this.findOrThrow(id, user.organizationId);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be sent');
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.SENT },
      include: { lines: true },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'invoice.sent',
      resourceType: 'Invoice',
      resourceId: id,
      after: updated,
    });
    await this.notifyCustomer(updated, user, {
      templateCode: 'INVOICE_SENT',
      subject: `Invoice ${updated.invoiceNumber} issued`,
      body: [
        `Invoice ${updated.invoiceNumber} has been issued.`,
        `Service: ${updated.serviceType ?? '—'}`,
        `Amount: ${Number(updated.totalAmount)} ${updated.currency}`,
        `Due: ${updated.dueDate.toISOString().slice(0, 10)}`,
        '',
        'Please arrange payment according to your contract terms.',
      ].join('\n'),
      idempotencyKey: `invoice-sent-${updated.id}`,
    });
    return this.toDto(updated, await this.contractNumberFor(updated.contractId));
  }

  /**
   * Void unpaid DRAFT / SENT / OVERDUE invoices. Partial/paid cannot be voided
   * (use credit note later). Creator may void; audit records reason.
   */
  async void(
    id: string,
    dto: VoidInvoiceDto,
    user: AuthUser,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.findOrThrow(id, user.organizationId);
    if (!VOIDABLE.includes(invoice.status)) {
      throw new BadRequestException(
        `Only DRAFT, SENT, OVERDUE, or DISPUTED invoices can be cancelled (now ${invoice.status})`,
      );
    }
    if (invoice.amountPaid.gt(0)) {
      throw new BadRequestException(
        'Cannot void an invoice with recorded payments',
      );
    }
    const reason = dto.reason?.trim() || null;
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.VOIDED,
        notes: reason
          ? [invoice.notes, `VOID: ${reason}`].filter(Boolean).join('\n')
          : invoice.notes,
      },
      include: { lines: true },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'invoice.voided',
      resourceType: 'Invoice',
      resourceId: id,
      before: { status: invoice.status },
      after: { status: updated.status, reason },
    });
    return this.toDto(
      updated,
      await this.contractNumberFor(updated.contractId),
    );
  }

  /**
   * Mark SENT / PARTIALLY_PAID invoices past due date as OVERDUE and queue
   * overdue / unpaid / suspension-risk EMAIL alerts (Module 21-A).
   */
  async scanOverdue(
    organizationId: string,
    actor: AuthUser,
  ): Promise<InvoiceScanOverdueResultDto> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const due = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: {
          in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID],
        },
        dueDate: { lt: today },
      },
      include: { lines: true },
      take: 500,
    });

    const invoiceNumbers: string[] = [];
    let overdueNotified = 0;
    for (const row of due) {
      const updated = await this.prisma.invoice.update({
        where: { id: row.id },
        data: { status: InvoiceStatus.OVERDUE },
        include: { lines: true },
      });
      invoiceNumbers.push(row.invoiceNumber);
      await this.audit.record({
        organizationId,
        actorId: actor.id,
        action: 'invoice.status.overdue',
        resourceType: 'Invoice',
        resourceId: row.id,
        before: { status: row.status },
        after: { status: InvoiceStatus.OVERDUE, dueDate: row.dueDate },
      });
      const queued = await this.notifyCustomer(updated, actor, {
        templateCode: 'INVOICE_OVERDUE',
        subject: `Overdue invoice ${updated.invoiceNumber}`,
        body: [
          `Invoice ${updated.invoiceNumber} is overdue.`,
          `Service: ${updated.serviceType ?? '—'}`,
          `Amount due: ${Number(updated.totalAmount) - Number(updated.amountPaid)} ${updated.currency}`,
          `Due date: ${updated.dueDate.toISOString().slice(0, 10)}`,
        ].join('\n'),
        idempotencyKey: `invoice-overdue-${updated.id}-${updated.dueDate.toISOString().slice(0, 10)}`,
      });
      if (queued) overdueNotified += 1;
    }

    const unpaid = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: InvoiceStatus.SENT,
        dueDate: { gte: today },
      },
      take: 200,
    });
    const weekKey = isoWeekKey(today);
    let unpaidReminders = 0;
    for (const row of unpaid) {
      const queued = await this.notifyCustomer(row, actor, {
        templateCode: 'INVOICE_UNPAID',
        subject: `Unpaid invoice ${row.invoiceNumber}`,
        body: [
          `Invoice ${row.invoiceNumber} is issued and unpaid.`,
          `Service: ${row.serviceType ?? '—'}`,
          `Amount: ${Number(row.totalAmount)} ${row.currency}`,
          `Due: ${row.dueDate.toISOString().slice(0, 10)}`,
        ].join('\n'),
        idempotencyKey: `invoice-unpaid-${row.id}-${weekKey}`,
      });
      if (queued) unpaidReminders += 1;
    }

    const suspensionCutoff = new Date(today);
    suspensionCutoff.setUTCDate(suspensionCutoff.getUTCDate() - SUSPENSION_GRACE_DAYS);
    const overdueLong = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: [InvoiceStatus.OVERDUE, InvoiceStatus.DISPUTED] },
        dueDate: { lt: suspensionCutoff },
      },
      take: 200,
    });
    let suspensionRisks = 0;
    for (const row of overdueLong) {
      if (Number(row.amountPaid) >= Number(row.totalAmount)) continue;
      const queued = await this.notifyCustomer(row, actor, {
        templateCode: 'INVOICE_SUSPENSION_RISK',
        subject: `Service suspension risk — invoice ${row.invoiceNumber}`,
        body: [
          `Invoice ${row.invoiceNumber} remains unpaid more than ${SUSPENSION_GRACE_DAYS} days past due.`,
          `Service: ${row.serviceType ?? '—'}`,
          `Outstanding: ${Number(row.totalAmount) - Number(row.amountPaid)} ${row.currency}`,
          'HIGHLINK may suspend related contracted services until the invoice is settled or disputed is resolved.',
        ].join('\n'),
        idempotencyKey: `invoice-suspend-${row.id}-${row.dueDate.toISOString().slice(0, 10)}`,
      });
      if (queued) suspensionRisks += 1;
    }

    return {
      markedOverdue: invoiceNumbers.length,
      invoiceNumbers,
      overdueNotified,
      unpaidReminders,
      suspensionRisks,
    };
  }

  async recordPayment(
    id: string,
    dto: RecordInvoicePaymentDto,
    user: AuthUser,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.findOrThrow(id, user.organizationId);
    if (
      invoice.status === InvoiceStatus.VOIDED ||
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.CLOSED ||
      invoice.status === InvoiceStatus.DRAFT
    ) {
      throw new BadRequestException('Invoice cannot accept payments');
    }

    const payment = await this.prisma.invoicePayment.create({
      data: {
        organizationId: user.organizationId,
        invoiceId: id,
        amount: new Prisma.Decimal(dto.amount),
        paymentMethod: dto.paymentMethod ?? PaymentMethod.BANK_TRANSFER,
        paymentReference: dto.paymentReference,
        recordedBy: user.id,
      },
    });

    const newPaid = invoice.amountPaid.add(payment.amount);
    let status: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
    if (newPaid.gte(invoice.totalAmount)) {
      status = InvoiceStatus.PAID;
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { amountPaid: newPaid, status },
      include: { lines: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'invoice.payment.recorded',
      resourceType: 'Invoice',
      resourceId: id,
      after: { payment, invoice: updated },
    });

    if (status === InvoiceStatus.PAID) {
      await this.notifyCustomer(updated, user, {
        templateCode: 'INVOICE_PAID',
        subject: `Payment received — invoice ${updated.invoiceNumber}`,
        body: [
          `Payment for invoice ${updated.invoiceNumber} is complete.`,
          `Service: ${updated.serviceType ?? '—'}`,
          `Amount paid: ${Number(updated.amountPaid)} ${updated.currency}`,
          `Reference: ${dto.paymentReference}`,
        ].join('\n'),
        idempotencyKey: `invoice-paid-${updated.id}`,
      });
    }

    return this.toDto(
      updated,
      await this.contractNumberFor(updated.contractId),
    );
  }

  async dispute(
    id: string,
    dto: DisputeInvoiceDto,
    user: AuthUser,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.findOrThrow(id, user.organizationId);
    if (!DISPUTABLE.includes(invoice.status)) {
      throw new BadRequestException(
        `Only issued, partially paid, or overdue invoices can be disputed (now ${invoice.status})`,
      );
    }
    const reason = dto.reason?.trim() || null;
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.DISPUTED,
        notes: reason
          ? [invoice.notes, `DISPUTED: ${reason}`].filter(Boolean).join('\n')
          : invoice.notes,
      },
      include: { lines: true },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'invoice.disputed',
      resourceType: 'Invoice',
      resourceId: id,
      before: { status: invoice.status },
      after: { status: updated.status, reason },
    });
    return this.toDto(
      updated,
      await this.contractNumberFor(updated.contractId),
    );
  }

  async close(id: string, user: AuthUser): Promise<InvoiceResponseDto> {
    const invoice = await this.findOrThrow(id, user.organizationId);
    if (invoice.status !== InvoiceStatus.PAID) {
      throw new BadRequestException(
        'Only fully paid invoices can be closed',
      );
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CLOSED },
      include: { lines: true },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'invoice.closed',
      resourceType: 'Invoice',
      resourceId: id,
      before: { status: invoice.status },
      after: { status: updated.status },
    });
    return this.toDto(
      updated,
      await this.contractNumberFor(updated.contractId),
    );
  }

  async listAlerts(
    organizationId: string,
  ): Promise<InvoiceAlertsPackDto> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const suspensionCutoff = new Date(today);
    suspensionCutoff.setUTCDate(
      suspensionCutoff.getUTCDate() - SUSPENSION_GRACE_DAYS,
    );
    const in90 = new Date(today);
    in90.setUTCDate(in90.getUTCDate() + 90);
    const paidSince = new Date();
    paidSince.setUTCDate(paidSince.getUTCDate() - 30);

    const recentPayments = await this.prisma.invoicePayment.findMany({
      where: { organizationId, recordedAt: { gte: paidSince } },
      select: { invoiceId: true },
      take: 80,
    });
    const recentPaidIds = [...new Set(recentPayments.map((p) => p.invoiceId))];

    const [
      overdueRows,
      unpaidRows,
      paidRows,
      payrollRows,
      expiring,
    ] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { organizationId, status: InvoiceStatus.OVERDUE },
        orderBy: { dueDate: 'asc' },
        take: 40,
      }),
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
        },
        orderBy: { dueDate: 'asc' },
        take: 40,
      }),
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          id: { in: recentPaidIds.length ? recentPaidIds : ['00000000-0000-0000-0000-000000000000'] },
          status: { in: [InvoiceStatus.PAID, InvoiceStatus.CLOSED, InvoiceStatus.PARTIALLY_PAID] },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          serviceType: 'CUSTOMER_PAYROLL',
          status: {
            in: [
              InvoiceStatus.SENT,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.OVERDUE,
              InvoiceStatus.PAID,
              InvoiceStatus.DISPUTED,
            ],
          },
        },
        orderBy: { dueDate: 'desc' },
        take: 20,
      }),
      this.prisma.contract.findMany({
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
        take: 20,
        select: {
          id: true,
          contractNumber: true,
          title: true,
          customerId: true,
          serviceType: true,
          endDate: true,
          status: true,
        },
      }),
    ]);

    const customerIds = [
      ...new Set(
        [
          ...overdueRows,
          ...unpaidRows,
          ...paidRows,
          ...payrollRows,
          ...expiring,
        ].map((r) => r.customerId),
      ),
    ];
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, code: true },
    });
    const nameById = new Map(customers.map((c) => [c.id, c.name]));

    const item = (
      kind: string,
      inv: {
        id: string;
        invoiceNumber: string;
        customerId: string;
        serviceType: string | null;
        status: InvoiceStatus;
        totalAmount: Prisma.Decimal;
        amountPaid: Prisma.Decimal;
        dueDate: Date;
        currency: string;
      },
      message: string,
    ) => ({
      kind,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId,
      customerName: nameById.get(inv.customerId) ?? null,
      serviceType: inv.serviceType,
      status: inv.status,
      amount: Number(inv.totalAmount) - Number(inv.amountPaid),
      dueDate: inv.dueDate,
      message,
    });

    const suspension = overdueRows.filter(
      (r) => r.dueDate < suspensionCutoff,
    );

    return {
      overdue: overdueRows.map((r) =>
        item(
          'OVERDUE',
          r,
          `Overdue ${r.invoiceNumber} · ${r.serviceType ?? 'service'} · ${nameById.get(r.customerId) ?? ''}`,
        ),
      ),
      unpaid: unpaidRows.map((r) =>
        item(
          'UNPAID',
          r,
          `Unpaid ${r.invoiceNumber} (${r.status}) due ${r.dueDate.toISOString().slice(0, 10)}`,
        ),
      ),
      completedPayments: paidRows.map((r) =>
        item(
          'PAID',
          r,
          `Payment complete ${r.invoiceNumber} · ${Number(r.amountPaid)} ${r.currency}`,
        ),
      ),
      payrollDueInvoices: payrollRows.map((r) =>
        item(
          'PAYROLL_DUE',
          r,
          `Payroll-service invoice ${r.invoiceNumber} is ${r.status} — e-payroll due only when fully paid`,
        ),
      ),
      contractExpiry: expiring.map((c) => ({
        kind: 'CONTRACT_EXPIRY',
        invoiceId: undefined,
        invoiceNumber: c.contractNumber,
        customerId: c.customerId,
        customerName: nameById.get(c.customerId) ?? null,
        serviceType: c.serviceType,
        status: c.status,
        amount: null,
        dueDate: c.endDate,
        message: `Contract ${c.contractNumber} ${c.status} — ends ${c.endDate.toISOString().slice(0, 10)}`,
      })),
      suspensionRisk: suspension.map((r) =>
        item(
          'SUSPENSION_RISK',
          r,
          `Service suspension risk: ${r.invoiceNumber} unpaid ${SUSPENSION_GRACE_DAYS}+ days past due`,
        ),
      ),
    };
  }

  async isCustomerInvoiceFullyPaid(
    customerId: string,
    organizationId: string,
  ): Promise<boolean> {
    const unpaid = await this.prisma.invoice.count({
      where: {
        organizationId,
        customerId,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE, InvoiceStatus.DISPUTED] },
      },
    });
    return unpaid === 0;
  }

  private async findOrThrow(id: string, organizationId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private async contractNumberFor(
    contractId: string | null,
  ): Promise<string | null> {
    if (!contractId) return null;
    const c = await this.prisma.contract.findFirst({
      where: { id: contractId },
      select: { contractNumber: true },
    });
    return c?.contractNumber ?? null;
  }

  private toDto(
    i: {
      id: string;
      organizationId: string;
      customerId: string;
      contractId: string | null;
      invoiceNumber: string;
      issueDate: Date;
      dueDate: Date;
      subtotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      amountPaid: Prisma.Decimal;
      currency: string;
      status: InvoiceStatus;
      serviceType?: string | null;
      notes: string | null;
      createdAt: Date;
      lines?: {
        id: string;
        description: string;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        amount: Prisma.Decimal;
      }[];
    },
    contractNumber: string | null = null,
    serviceType?: string | null,
  ): InvoiceResponseDto {
    return {
      id: i.id,
      organizationId: i.organizationId,
      customerId: i.customerId,
      contractId: i.contractId,
      contractNumber,
      invoiceNumber: i.invoiceNumber,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      subtotal: Number(i.subtotal),
      taxAmount: Number(i.taxAmount),
      totalAmount: Number(i.totalAmount),
      amountPaid: Number(i.amountPaid),
      currency: i.currency,
      serviceType: i.serviceType ?? serviceType ?? null,
      status: i.status,
      notes: i.notes,
      lines: (i.lines ?? []).map((l) => ({
        id: l.id,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        amount: Number(l.amount),
      })),
      createdAt: i.createdAt,
    };
  }

  private normalizeServiceType(
    raw?: string | null,
    strict = true,
  ): string | null {
    if (!raw?.trim()) return null;
    const v = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
    const aliases: Record<string, string> = {
      GUARD: 'SECURITY_GUARD',
      SECURITY: 'SECURITY_GUARD',
      CCTV: 'CCTV_MONITORING',
      ACCESS: 'ACCESS_CONTROL',
      VISITOR: 'VISITOR_MANAGEMENT',
      VISITORS: 'VISITOR_MANAGEMENT',
      PAYROLL: 'CUSTOMER_PAYROLL',
      ALARM: 'ALARM_RESPONSE',
      TECHNICAL_SECURITY: 'TECHNICAL',
    };
    const mapped = aliases[v] ?? v;
    if (ALLOWED_SERVICE.has(mapped)) return mapped;
    if (strict) {
      throw new BadRequestException(`Unknown invoice service type ${raw}`);
    }
    return null;
  }

  private async notifyCustomer(
    invoice: {
      id: string;
      customerId: string;
      invoiceNumber: string;
      organizationId: string;
    },
    actor: AuthUser,
    opts: {
      templateCode: string;
      subject: string;
      body: string;
      idempotencyKey: string;
    },
  ): Promise<boolean> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: invoice.customerId, organizationId: actor.organizationId },
      select: { billingEmail: true, email: true, opsEmail: true },
    });
    const recipient =
      customer?.billingEmail?.trim() ||
      customer?.email?.trim() ||
      customer?.opsEmail?.trim() ||
      null;
    if (!recipient) return false;
    try {
      await this.notifications.enqueue(
        {
          channel: NotificationChannel.EMAIL,
          recipient,
          templateCode: opts.templateCode,
          subject: opts.subject,
          body: opts.body,
          resourceType: 'Invoice',
          resourceId: invoice.id,
          idempotencyKey: opts.idempotencyKey,
        },
        actor,
      );
      return true;
    } catch {
      return false;
    }
  }
}

function isoWeekKey(d: Date): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
