import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  B2bPartnerStatus,
  GuardSupplyGenderPreference,
  GuardSupplyRequestStatus,
  GuardSupplyUrgency,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '@pssms/audit';
import { InvoicesService } from '@pssms/finance';
import {
  AuthUser,
  PrismaService,
  evaluatePasswordPolicy,
  getOrgContext,
  normalizePasswordPolicy,
  requireB2bPartnerScope,
} from '@pssms/shared';
import {
  B2bCustomerOptionDto,
  B2bPartnerProfileDto,
  B2bRequestOptionsDto,
  CreateGuardSupplyRequestDto,
  GuardSupplyRequestResponseDto,
  RegisterB2bPartnerDto,
  RegisterB2bPartnerResponseDto,
  UpdateB2bPartnerCustomerDto,
  UpdateGuardSupplyRequestChargesDto,
  UpdateGuardSupplyRequestStatusDto,
} from '../presentation/dto/recruitment-b2b.dto';
import {
  GUARD_SUPPLY_REQUIRED_FIELDS,
  GUARD_SUPPLY_URGENCY_OPTIONS,
} from '../domain/b2b-request-catalog';

const STAFF_STATUSES: GuardSupplyRequestStatus[] = [
  GuardSupplyRequestStatus.UNDER_REVIEW,
  GuardSupplyRequestStatus.ACCEPTED,
  GuardSupplyRequestStatus.REJECTED,
];

function decimalToNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  return Number(value);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function calcServiceFee(
  guardCount: number,
  unitRatePerGuard: number,
  discountAmount = 0,
): number {
  const gross = roundMoney(unitRatePerGuard * guardCount);
  return roundMoney(Math.max(0, gross - discountAmount));
}

@Injectable()
export class RecruitmentB2bService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
  ) {}

  private hasStaffRecruitment(user: AuthUser): boolean {
    return user.permissions.includes('recruitment.manage');
  }

  private assertPartnerNotSuspended(status: B2bPartnerStatus) {
    if (status === B2bPartnerStatus.SUSPENDED) {
      throw new ForbiddenException({
        error: 'B2B_PARTNER_SUSPENDED',
        message: 'Partner account is suspended',
      });
    }
  }

  private async requirePartnerForUser(user: AuthUser) {
    const partnerId = requireB2bPartnerScope(user);
    const partner = await this.prisma.b2bSecurityPartner.findFirst({
      where: { id: partnerId, organizationId: user.organizationId },
    });
    if (!partner) throw new NotFoundException('B2B partner not found');
    this.assertPartnerNotSuspended(partner.status);
    return partner;
  }

  private async withPublicOrg<T>(fn: () => Promise<T>): Promise<T> {
    if (getOrgContext()?.organizationId) return fn();
    const org = await this.prisma.organization.findFirst({
      where: { code: 'HIGHLINK' },
    });
    if (!org) throw new NotFoundException('Demo organization not found');
    return this.prisma.runInRequestContext({ organizationId: org.id }, fn);
  }

  async registerPartner(
    dto: RegisterB2bPartnerDto,
  ): Promise<RegisterB2bPartnerResponseDto> {
    return this.withPublicOrg(async () => {
      const org = await this.prisma.organization.findFirst({
        where: { code: 'HIGHLINK' },
      });
      if (!org) throw new NotFoundException('Demo organization not found');

      const email = dto.email.toLowerCase().trim();
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new ConflictException({
          error: 'EMAIL_IN_USE',
          message: 'That email is already registered',
        });
      }

      const policy = normalizePasswordPolicy(org.passwordPolicy);
      const policyFailures = evaluatePasswordPolicy(dto.password, policy);
      if (policyFailures.length > 0) {
        throw new BadRequestException({
          error: 'WEAK_PASSWORD',
          message: `Password must contain ${policyFailures.join(', ')}`,
        });
      }

      const role = await this.prisma.role.findFirst({
        where: { organizationId: org.id, code: 'OTHER_SECURITY_COMPANY' },
      });
      if (!role) {
        throw new BadRequestException({
          error: 'ROLE_MISSING',
          message: 'OTHER_SECURITY_COMPANY role is not configured',
        });
      }

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const companyName = dto.companyName.trim();
      const contactName = dto.contactName.trim();
      const phone = dto.phone?.trim() || null;

      let partner: Awaited<
        ReturnType<typeof this.prisma.b2bSecurityPartner.create>
      > | null = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = nextPartnerCode(companyName);
        try {
          partner = await this.prisma.b2bSecurityPartner.create({
            data: {
              organizationId: org.id,
              code,
              name: companyName,
              email,
              phone,
              status: B2bPartnerStatus.PENDING,
            },
          });
          break;
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            continue;
          }
          throw err;
        }
      }
      if (!partner) {
        throw new BadRequestException({
          error: 'PARTNER_CODE_FAILED',
          message: 'Could not allocate a partner code. Try again.',
        });
      }

      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: contactName,
          phone,
          organizationId: org.id,
          b2bPartnerId: partner.id,
          mustChangePassword: false,
          roles: { create: [{ roleId: role.id }] },
        },
      });

      await this.prisma.b2bSecurityPartner.update({
        where: { id: partner.id },
        data: { createdBy: user.id },
      });

      await this.audit.record({
        organizationId: org.id,
        actorId: user.id,
        action: 'b2b.partner.registered',
        resourceType: 'B2bSecurityPartner',
        resourceId: partner.id,
        after: {
          code: partner.code,
          name: partner.name,
          status: partner.status,
          email,
        },
      });

      return {
        partnerId: partner.id,
        code: partner.code,
        name: partner.name,
        status: partner.status,
        email,
        message:
          'Registration received. Sign in with this email. HIGHLINK must approve the partner before you can submit guard supply requests.',
      };
    });
  }

  async listPartners(user: AuthUser): Promise<B2bPartnerProfileDto[]> {
    if (!this.hasStaffRecruitment(user)) {
      throw new ForbiddenException({
        error: 'RECRUITMENT_MANAGE_REQUIRED',
        message: 'Staff recruitment access required',
      });
    }
    const rows = await this.prisma.b2bSecurityPartner.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const customerIds = [
      ...new Set(rows.map((p) => p.customerId).filter((id): id is string => !!id)),
    ];
    const customers =
      customerIds.length > 0
        ? await this.prisma.customer.findMany({
            where: {
              organizationId: user.organizationId,
              id: { in: customerIds },
            },
            select: { id: true, code: true, name: true },
          })
        : [];
    const customerById = new Map(customers.map((c) => [c.id, c]));
    return rows.map((p) =>
      this.toPartnerDto(p, customerById.get(p.customerId ?? '')),
    );
  }

  async listCustomerOptions(user: AuthUser): Promise<B2bCustomerOptionDto[]> {
    if (!this.hasStaffRecruitment(user)) {
      throw new ForbiddenException({
        error: 'RECRUITMENT_MANAGE_REQUIRED',
        message: 'Staff recruitment access required',
      });
    }
    const rows = await this.prisma.customer.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
    return rows;
  }

  async updatePartnerCustomer(
    id: string,
    dto: UpdateB2bPartnerCustomerDto,
    user: AuthUser,
  ): Promise<B2bPartnerProfileDto> {
    if (!this.hasStaffRecruitment(user)) {
      throw new ForbiddenException({
        error: 'RECRUITMENT_MANAGE_REQUIRED',
        message: 'Staff recruitment access required',
      });
    }

    const existing = await this.prisma.b2bSecurityPartner.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('B2B partner not found');

    let customer: { id: string; code: string; name: string } | null = null;
    if (dto.customerId) {
      customer = await this.prisma.customer.findFirst({
        where: {
          id: dto.customerId,
          organizationId: user.organizationId,
          isActive: true,
        },
        select: { id: true, code: true, name: true },
      });
      if (!customer) {
        throw new BadRequestException({
          error: 'INVALID_CUSTOMER',
          message: 'Customer not found or inactive',
        });
      }
    }

    const row = await this.prisma.b2bSecurityPartner.update({
      where: { id },
      data: { customerId: dto.customerId ?? null },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'b2b.partner.customer_linked',
      resourceType: 'B2bSecurityPartner',
      resourceId: row.id,
      before: { customerId: existing.customerId },
      after: { customerId: row.customerId, customerCode: customer?.code ?? null },
    });

    return this.toPartnerDto(row, customer ?? undefined);
  }

  async updatePartnerStatus(
    id: string,
    status: B2bPartnerStatus,
    user: AuthUser,
  ): Promise<B2bPartnerProfileDto> {
    if (!this.hasStaffRecruitment(user)) {
      throw new ForbiddenException({
        error: 'RECRUITMENT_MANAGE_REQUIRED',
        message: 'Staff recruitment access required',
      });
    }
    if (
      status !== B2bPartnerStatus.APPROVED &&
      status !== B2bPartnerStatus.SUSPENDED
    ) {
      throw new BadRequestException({
        error: 'INVALID_PARTNER_STATUS',
        message: 'Staff may set APPROVED or SUSPENDED',
      });
    }

    const existing = await this.prisma.b2bSecurityPartner.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('B2B partner not found');
    if (existing.createdBy && existing.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_APPROVE',
        message: 'The officer who registered this partner cannot approve it',
      });
    }

    const row = await this.prisma.b2bSecurityPartner.update({
      where: { id },
      data: { status },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'b2b.partner.status_updated',
      resourceType: 'B2bSecurityPartner',
      resourceId: row.id,
      before: { status: existing.status },
      after: { status: row.status },
    });

    let customer: { id: string; code: string; name: string } | undefined;
    if (row.customerId) {
      customer =
        (await this.prisma.customer.findFirst({
          where: {
            id: row.customerId,
            organizationId: user.organizationId,
          },
          select: { id: true, code: true, name: true },
        })) ?? undefined;
    }
    return this.toPartnerDto(row, customer);
  }

  async updateRequestCharges(
    id: string,
    dto: UpdateGuardSupplyRequestChargesDto,
    user: AuthUser,
  ): Promise<GuardSupplyRequestResponseDto> {
    if (!this.hasStaffRecruitment(user)) {
      throw new ForbiddenException({
        error: 'RECRUITMENT_MANAGE_REQUIRED',
        message: 'Staff recruitment access required',
      });
    }

    const existing = await this.prisma.guardSupplyRequest.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { partner: true },
    });
    if (!existing) throw new NotFoundException('Guard supply request not found');

    if (existing.status !== GuardSupplyRequestStatus.ACCEPTED) {
      throw new BadRequestException({
        error: 'REQUEST_NOT_BILLABLE',
        message: 'Only ACCEPTED requests can have service charges set',
      });
    }
    if (existing.invoiceId) {
      throw new ConflictException({
        error: 'ALREADY_BILLED',
        message: 'Request already has a linked invoice',
      });
    }

    const unitRate = roundMoney(dto.unitRatePerGuard);
    const discount = roundMoney(dto.discountAmount ?? 0);
    const serviceFeeAmount = calcServiceFee(
      existing.guardCount,
      unitRate,
      discount,
    );
    if (serviceFeeAmount <= 0) {
      throw new BadRequestException({
        error: 'FEE_REQUIRED',
        message: 'Net service fee must be greater than zero',
      });
    }

    const currency = (dto.currency?.trim() || 'TZS').toUpperCase();
    const row = await this.prisma.guardSupplyRequest.update({
      where: { id },
      data: {
        unitRatePerGuard: unitRate,
        discountAmount: discount,
        serviceFeeAmount,
        currency,
      },
      include: { partner: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'b2b.guard_supply.charges_updated',
      resourceType: 'GuardSupplyRequest',
      resourceId: row.id,
      after: {
        referenceNumber: row.referenceNumber,
        unitRatePerGuard: unitRate,
        discountAmount: discount,
        serviceFeeAmount,
        currency,
      },
    });

    return this.enrichRequestDtos(user.organizationId, [row]).then(([dto]) => dto);
  }

  /**
   * Create DRAFT invoice for ACCEPTED request with charges set.
   * Requires partner.customerId. Does not auto-bill on accept.
   */
  async billRequest(
    id: string,
    user: AuthUser,
    opts?: { sendInvoice?: boolean },
  ): Promise<GuardSupplyRequestResponseDto> {
    if (!this.hasStaffRecruitment(user)) {
      throw new ForbiddenException({
        error: 'RECRUITMENT_MANAGE_REQUIRED',
        message: 'Staff recruitment access required',
      });
    }

    const existing = await this.prisma.guardSupplyRequest.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { partner: true },
    });
    if (!existing) throw new NotFoundException('Guard supply request not found');

    if (existing.invoiceId) {
      throw new ConflictException({
        error: 'ALREADY_BILLED',
        message: 'Request already has a linked invoice',
      });
    }

    if (existing.status !== GuardSupplyRequestStatus.ACCEPTED) {
      throw new BadRequestException({
        error: 'REQUEST_NOT_BILLABLE',
        message: 'Only ACCEPTED requests can be billed',
      });
    }

    const fee = decimalToNumber(existing.serviceFeeAmount);
    const unitRate = decimalToNumber(existing.unitRatePerGuard);
    if (fee == null || fee <= 0 || unitRate == null || unitRate <= 0) {
      throw new BadRequestException({
        error: 'FEE_REQUIRED',
        message: 'Set unitRatePerGuard and service fee before billing',
      });
    }

    const customerId = existing.partner.customerId;
    if (!customerId) {
      throw new BadRequestException({
        error: 'CUSTOMER_REQUIRED_FOR_BILLING',
        message: 'Partner must be linked to a CRM customer before billing',
      });
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: user.organizationId },
      select: { id: true, code: true, name: true },
    });
    if (!customer) {
      throw new BadRequestException({
        error: 'INVALID_CUSTOMER',
        message: 'Linked customer not found',
      });
    }

    const discount = decimalToNumber(existing.discountAmount) ?? 0;
    const currency = (existing.currency?.trim() || 'TZS').toUpperCase();
    const issue = new Date();
    const due = new Date(issue);
    due.setDate(due.getDate() + 30);
    const ymd = issue.toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNumber = `INV-B2B-${existing.referenceNumber}-${ymd}`;

    const gross = roundMoney(unitRate * existing.guardCount);
    const afterDiscount = Math.max(0, gross - discount);
    let lineUnit = unitRate;
    let lineQty = existing.guardCount;
    if (discount > 0 && lineQty > 0) {
      lineUnit = roundMoney(afterDiscount / lineQty);
    }

    let invoice = await this.invoices.create(
      {
        customerId,
        invoiceNumber,
        issueDate: issue.toISOString().slice(0, 10),
        dueDate: due.toISOString().slice(0, 10),
        currency,
        serviceType: 'RECRUITMENT',
        notes: [
          `B2B guard supply · ${existing.referenceNumber}`,
          existing.partner.name,
          existing.siteLocation,
          discount > 0 ? `Discount ${discount}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        lines: [
          {
            description: `Guard supply service · ${existing.referenceNumber} · ${existing.guardCount} guards`,
            quantity: lineQty,
            unitPrice: lineUnit,
          },
        ],
      },
      user,
    );

    if (opts?.sendInvoice) {
      invoice = await this.invoices.send(invoice.id, user);
    }

    const billedAt = new Date();
    const row = await this.prisma.guardSupplyRequest.update({
      where: { id },
      data: {
        invoiceId: invoice.id,
        billedAt,
      },
      include: { partner: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'b2b.guard_supply.billed',
      resourceType: 'GuardSupplyRequest',
      resourceId: row.id,
      after: {
        referenceNumber: existing.referenceNumber,
        serviceFeeAmount: fee,
        currency,
        unitRatePerGuard: unitRate,
        discountAmount: discount,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceStatus: invoice.status,
        sendInvoice: !!opts?.sendInvoice,
        customerId,
        partnerId: existing.partnerId,
        billedAt,
      },
    });

    return this.enrichRequestDtos(user.organizationId, [row]).then(([dto]) => dto);
  }

  async getPartnerMe(user: AuthUser): Promise<B2bPartnerProfileDto> {
    const partner = await this.requirePartnerForUser(user);
    return this.toPartnerDto(partner);
  }

  requestOptions(): B2bRequestOptionsDto {
    return {
      urgencies: [...GUARD_SUPPLY_URGENCY_OPTIONS],
      requiredFields: [...GUARD_SUPPLY_REQUIRED_FIELDS],
    };
  }

  async createRequest(
    dto: CreateGuardSupplyRequestDto,
    user: AuthUser,
  ): Promise<GuardSupplyRequestResponseDto> {
    const partner = await this.requirePartnerForUser(user);
    if (partner.status !== B2bPartnerStatus.APPROVED) {
      throw new ForbiddenException({
        error: 'B2B_PARTNER_NOT_APPROVED',
        message: 'Partner must be APPROVED before submitting requests',
      });
    }

    const siteLocation = dto.siteLocation.trim();
    const qualifications = dto.qualifications.trim();
    const trainingNeeds = dto.trainingNeeds.trim();
    const serviceTerms = dto.serviceTerms.trim();
    if (
      siteLocation.length < 2 ||
      qualifications.length < 2 ||
      trainingNeeds.length < 2 ||
      serviceTerms.length < 2
    ) {
      throw new BadRequestException({
        error: 'B2B_CRITERIA_REQUIRED',
        message:
          'Specify location, qualifications, training needs, and service terms',
      });
    }

    if (
      dto.startDate &&
      dto.endDate &&
      new Date(dto.endDate) < new Date(dto.startDate)
    ) {
      throw new BadRequestException({
        error: 'INVALID_DATE_RANGE',
        message: 'endDate must be on or after startDate',
      });
    }

    if (
      dto.ageMin != null &&
      dto.ageMax != null &&
      dto.ageMin > dto.ageMax
    ) {
      throw new BadRequestException({
        error: 'INVALID_AGE_RANGE',
        message: 'ageMin must be less than or equal to ageMax',
      });
    }

    let row: Awaited<ReturnType<typeof this.prisma.guardSupplyRequest.create>> | null =
      null;
    let referenceNumber = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      referenceNumber = await this.nextReference(user.organizationId);
      try {
        row = await this.prisma.guardSupplyRequest.create({
          data: {
            organizationId: user.organizationId,
            partnerId: partner.id,
            referenceNumber,
            guardCount: dto.guardCount,
            siteLocation,
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            qualifications,
            trainingNeeds,
            urgency: dto.urgency,
            serviceTerms,
            criteriaNotes: dto.criteriaNotes?.trim() || null,
            experienceYearsMin: dto.experienceYearsMin ?? null,
            ageMin: dto.ageMin ?? null,
            ageMax: dto.ageMax ?? null,
            genderPreference:
              dto.genderPreference ?? GuardSupplyGenderPreference.ANY,
            militaryTrainingRequired: dto.militaryTrainingRequired ?? false,
            firearmTrainingRequired: dto.firearmTrainingRequired ?? false,
            languages: dto.languages?.trim() || null,
            heightMinCm: dto.heightMinCm ?? null,
            healthConditionNotes: dto.healthConditionNotes?.trim() || null,
            status: GuardSupplyRequestStatus.SUBMITTED,
            createdBy: user.id,
          },
          include: { partner: true },
        });
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }
    if (!row) {
      throw new BadRequestException({
        error: 'REFERENCE_ALLOCATION_FAILED',
        message: 'Could not allocate unique request reference',
      });
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'b2b.guard_supply.created',
      resourceType: 'GuardSupplyRequest',
      resourceId: row.id,
      after: {
        referenceNumber,
        guardCount: row.guardCount,
        partnerId: partner.id,
        urgency: row.urgency,
      },
    });

    return this.toRequestDto(row);
  }

  async listRequests(
    user: AuthUser,
    status?: GuardSupplyRequestStatus,
  ): Promise<GuardSupplyRequestResponseDto[]> {
    const where: Prisma.GuardSupplyRequestWhereInput = {
      organizationId: user.organizationId,
    };
    if (status) where.status = status;

    if (user.b2bPartnerId) {
      await this.requirePartnerForUser(user);
      where.partnerId = user.b2bPartnerId;
    } else if (!this.hasStaffRecruitment(user)) {
      throw new ForbiddenException({
        error: 'RECRUITMENT_MANAGE_REQUIRED',
        message: 'Staff recruitment access required',
      });
    }

    const rows = await this.prisma.guardSupplyRequest.findMany({
      where,
      include: { partner: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.enrichRequestDtos(user.organizationId, rows);
  }

  async getRequest(
    id: string,
    user: AuthUser,
  ): Promise<GuardSupplyRequestResponseDto> {
    const row = await this.prisma.guardSupplyRequest.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { partner: true },
    });
    if (!row) throw new NotFoundException('Guard supply request not found');

    if (user.b2bPartnerId) {
      await this.requirePartnerForUser(user);
      if (row.partnerId !== user.b2bPartnerId) {
        // Avoid cross-partner existence oracle
        throw new NotFoundException('Guard supply request not found');
      }
    } else if (!this.hasStaffRecruitment(user)) {
      throw new ForbiddenException({
        error: 'RECRUITMENT_MANAGE_REQUIRED',
        message: 'Staff recruitment access required',
      });
    }

    const [dto] = await this.enrichRequestDtos(user.organizationId, [row]);
    return dto;
  }

  async updateStatus(
    id: string,
    dto: UpdateGuardSupplyRequestStatusDto,
    user: AuthUser,
  ): Promise<GuardSupplyRequestResponseDto> {
    if (user.b2bPartnerId) {
      throw new ForbiddenException({
        error: 'B2B_PARTNER_READ_OWN',
        message: 'Partners cannot triage requests',
      });
    }
    if (!this.hasStaffRecruitment(user)) {
      throw new ForbiddenException({
        error: 'RECRUITMENT_MANAGE_REQUIRED',
        message: 'Staff recruitment access required',
      });
    }
    if (!STAFF_STATUSES.includes(dto.status)) {
      throw new BadRequestException({
        error: 'INVALID_STATUS',
        message: `Staff may set: ${STAFF_STATUSES.join(', ')}`,
      });
    }

    const existing = await this.prisma.guardSupplyRequest.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Guard supply request not found');

    if (existing.createdBy && existing.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_PROCESS',
        message: 'Creator cannot triage their own request',
      });
    }

    const terminal: GuardSupplyRequestStatus[] = [
      GuardSupplyRequestStatus.ACCEPTED,
      GuardSupplyRequestStatus.REJECTED,
    ];
    if (
      terminal.includes(existing.status) &&
      existing.status !== dto.status &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new BadRequestException({
        error: 'TERMINAL_STATUS',
        message: `Cannot change status from ${existing.status}`,
      });
    }

    const row = await this.prisma.guardSupplyRequest.update({
      where: { id },
      data: {
        status: dto.status,
        staffNotes:
          dto.staffNotes !== undefined
            ? dto.staffNotes.trim() || null
            : existing.staffNotes,
        processedBy: user.id,
        processedAt: new Date(),
      },
      include: { partner: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'b2b.guard_supply.status_updated',
      resourceType: 'GuardSupplyRequest',
      resourceId: row.id,
      before: { status: existing.status },
      after: { status: row.status, staffNotes: row.staffNotes },
    });

    return this.enrichRequestDtos(user.organizationId, [row]).then(([dto]) => dto);
  }

  private async enrichRequestDtos(
    organizationId: string,
    rows: Array<
      Parameters<RecruitmentB2bService['toRequestDto']>[0] & {
        invoiceId?: string | null;
      }
    >,
  ): Promise<GuardSupplyRequestResponseDto[]> {
    const payments = await this.invoices.paymentSummaries(
      organizationId,
      rows.map((r) => r.invoiceId),
    );
    return rows.map((r) => {
      const pay = r.invoiceId ? payments.get(r.invoiceId) : undefined;
      return this.toRequestDto(
        r,
        pay
          ? {
              invoiceNumber: pay.invoiceNumber,
              invoiceStatus: pay.status,
              amountPaid: pay.amountPaid,
              balanceDue: pay.balanceDue,
            }
          : undefined,
      );
    });
  }

  private async nextReference(organizationId: string): Promise<string> {
    const count = await this.prisma.guardSupplyRequest.count({
      where: { organizationId },
    });
    return `GSR-${String(count + 1).padStart(5, '0')}`;
  }

  private toPartnerDto(
    p: {
      id: string;
      organizationId: string;
      code: string;
      name: string;
      email: string | null;
      phone: string | null;
      status: B2bPartnerStatus;
      customerId?: string | null;
      createdAt: Date;
    },
    customer?: { id: string; code: string; name: string },
  ): B2bPartnerProfileDto {
    return {
      id: p.id,
      organizationId: p.organizationId,
      code: p.code,
      name: p.name,
      email: p.email,
      phone: p.phone,
      status: p.status,
      customerId: p.customerId ?? null,
      customerCode: customer?.code ?? null,
      customerName: customer?.name ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  }

  private toRequestDto(
    r: {
      id: string;
      organizationId: string;
      partnerId: string;
      referenceNumber: string;
      guardCount: number;
      siteLocation: string | null;
      startDate: Date | null;
      endDate: Date | null;
      qualifications: string | null;
      trainingNeeds: string | null;
      urgency: GuardSupplyUrgency;
      serviceTerms: string | null;
      criteriaNotes: string | null;
      experienceYearsMin?: number | null;
      ageMin?: number | null;
      ageMax?: number | null;
      genderPreference?: GuardSupplyGenderPreference | null;
      militaryTrainingRequired?: boolean;
      firearmTrainingRequired?: boolean;
      languages?: string | null;
      heightMinCm?: number | null;
      healthConditionNotes?: string | null;
      unitRatePerGuard?: Prisma.Decimal | null;
      serviceFeeAmount?: Prisma.Decimal | null;
      currency?: string | null;
      discountAmount?: Prisma.Decimal | null;
      invoiceId?: string | null;
      billedAt?: Date | null;
      status: GuardSupplyRequestStatus;
      processedBy: string | null;
      processedAt: Date | null;
      staffNotes: string | null;
      createdAt: Date;
      createdBy: string | null;
      partner?: { code: string; name: string } | null;
    },
    invoiceEnrich?: {
      invoiceNumber: string;
      invoiceStatus: string;
      amountPaid: number;
      balanceDue: number;
    },
  ): GuardSupplyRequestResponseDto {
    return {
      id: r.id,
      organizationId: r.organizationId,
      partnerId: r.partnerId,
      partnerCode: r.partner?.code ?? null,
      partnerName: r.partner?.name ?? null,
      referenceNumber: r.referenceNumber,
      guardCount: r.guardCount,
      siteLocation: r.siteLocation,
      startDate: r.startDate
        ? r.startDate.toISOString().slice(0, 10)
        : null,
      endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
      qualifications: r.qualifications,
      trainingNeeds: r.trainingNeeds,
      urgency: r.urgency,
      serviceTerms: r.serviceTerms,
      criteriaNotes: r.criteriaNotes,
      experienceYearsMin: r.experienceYearsMin ?? null,
      ageMin: r.ageMin ?? null,
      ageMax: r.ageMax ?? null,
      genderPreference: r.genderPreference ?? null,
      militaryTrainingRequired: r.militaryTrainingRequired ?? false,
      firearmTrainingRequired: r.firearmTrainingRequired ?? false,
      languages: r.languages ?? null,
      heightMinCm: r.heightMinCm ?? null,
      healthConditionNotes: r.healthConditionNotes ?? null,
      unitRatePerGuard: decimalToNumber(r.unitRatePerGuard),
      serviceFeeAmount: decimalToNumber(r.serviceFeeAmount),
      currency: r.currency ?? null,
      discountAmount: decimalToNumber(r.discountAmount),
      invoiceId: r.invoiceId ?? null,
      billedAt: r.billedAt?.toISOString() ?? null,
      invoiceNumber: invoiceEnrich?.invoiceNumber ?? null,
      invoiceStatus: invoiceEnrich?.invoiceStatus ?? null,
      amountPaid: invoiceEnrich?.amountPaid ?? null,
      balanceDue: invoiceEnrich?.balanceDue ?? null,
      status: r.status,
      processedBy: r.processedBy,
      processedAt: r.processedAt?.toISOString() ?? null,
      staffNotes: r.staffNotes,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy,
    };
  }
}

function nextPartnerCode(companyName: string): string {
  const slug =
    companyName.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 8).toUpperCase() ||
    'OSC';
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `OSC-${slug}-${rand}`;
}
