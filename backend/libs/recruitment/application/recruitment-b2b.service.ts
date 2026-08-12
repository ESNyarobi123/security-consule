import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  B2bPartnerStatus,
  GuardSupplyRequestStatus,
  GuardSupplyUrgency,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '@pssms/audit';
import {
  AuthUser,
  PrismaService,
  evaluatePasswordPolicy,
  getOrgContext,
  normalizePasswordPolicy,
  requireB2bPartnerScope,
} from '@pssms/shared';
import {
  B2bPartnerProfileDto,
  CreateGuardSupplyRequestDto,
  GuardSupplyRequestResponseDto,
  RegisterB2bPartnerDto,
  RegisterB2bPartnerResponseDto,
  UpdateGuardSupplyRequestStatusDto,
} from '../presentation/dto/recruitment-b2b.dto';

const STAFF_STATUSES: GuardSupplyRequestStatus[] = [
  GuardSupplyRequestStatus.UNDER_REVIEW,
  GuardSupplyRequestStatus.ACCEPTED,
  GuardSupplyRequestStatus.REJECTED,
];

@Injectable()
export class RecruitmentB2bService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
    return rows.map((p) => this.toPartnerDto(p));
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

    return this.toPartnerDto(row);
  }

  async getPartnerMe(user: AuthUser): Promise<B2bPartnerProfileDto> {
    const partner = await this.requirePartnerForUser(user);
    return this.toPartnerDto(partner);
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
            siteLocation: dto.siteLocation.trim(),
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            qualifications: dto.qualifications?.trim() || null,
            trainingNeeds: dto.trainingNeeds?.trim() || null,
            urgency: dto.urgency ?? GuardSupplyUrgency.STANDARD,
            serviceTerms: dto.serviceTerms?.trim() || null,
            criteriaNotes: dto.criteriaNotes?.trim() || null,
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
    return rows.map((r) => this.toRequestDto(r));
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

    return this.toRequestDto(row);
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

    return this.toRequestDto(row);
  }

  private async nextReference(organizationId: string): Promise<string> {
    const count = await this.prisma.guardSupplyRequest.count({
      where: { organizationId },
    });
    return `GSR-${String(count + 1).padStart(5, '0')}`;
  }

  private toPartnerDto(p: {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: B2bPartnerStatus;
    createdAt: Date;
  }): B2bPartnerProfileDto {
    return {
      id: p.id,
      organizationId: p.organizationId,
      code: p.code,
      name: p.name,
      email: p.email,
      phone: p.phone,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    };
  }

  private toRequestDto(r: {
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
    status: GuardSupplyRequestStatus;
    processedBy: string | null;
    processedAt: Date | null;
    staffNotes: string | null;
    createdAt: Date;
    createdBy: string | null;
    partner?: { code: string; name: string } | null;
  }): GuardSupplyRequestResponseDto {
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
