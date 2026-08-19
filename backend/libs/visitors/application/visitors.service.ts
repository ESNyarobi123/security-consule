import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppointmentStatus,
  VerificationResult,
  VisitorEntryDirection,
  VisitorIdType,
} from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  generateVerificationCode,
  hashVerificationCode,
  getOrgContext,
  isContractorSelfScoped,
  isConsultantSelfScoped,
  isServiceProviderSelfScoped,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  NotificationsService,
  OutboxWriterService,
} from '@pssms/notifications';
import {
  CreateVisitorAppointmentDto,
  GateDenyHostNotifiedDto,
  GateExitDto,
  GateExitResponseDto,
  GateVerifyDto,
  GateVerifyResponseDto,
  IssueCodeResponseDto,
  RejectAppointmentDto,
  VISIT_KIND_OPTIONS,
  VisitKind,
  VisitorAppointmentResponseDto,
  VisitorEntryResponseDto,
  VisitorPublicConfigDto,
} from '../presentation/dto/visitor.dto';

const HOST_ROLE_CODES = ['CUSTOMER_PORTAL', 'CUSTOMER_EMPLOYEE'] as const;

/** Light in-memory gate-verify rate limit: max attempts per user+site window. */
const GATE_VERIFY_RATE_LIMIT = 30;
const GATE_VERIFY_WINDOW_MS = 60_000;

/** Module 12-A — FieldAlert type for gate deny (branch /ops escalate ladder). */
const VISITOR_GATE_DENIED_ALERT = 'VISITOR_GATE_DENIED';

@Injectable()
export class VisitorsService {
  private readonly gateVerifyAttempts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly outbox: OutboxWriterService,
  ) {}

  async publicConfig(): Promise<VisitorPublicConfigDto> {
    // Organization lookup is outside RLS tenant tables; customer/site need org
    // context (same pattern as public createAppointment — fail-closed RLS).
    const org = await this.prisma.organization.findFirst({
      where: { code: 'HIGHLINK' },
    });
    if (!org) throw new NotFoundException('Demo organization not found');

    return this.prisma.runInRequestContext({ organizationId: org.id }, async () => {
      const customer = await this.prisma.customer.findFirst({
        where: { organizationId: org.id, code: 'CUST-DEMO' },
      });
      if (!customer) throw new NotFoundException('Demo customer not found');

      const sites = await this.prisma.site.findMany({
        where: {
          organizationId: org.id,
          isActive: true,
          customerId: customer.id,
        },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
        take: 40,
      });
      const warehouse = sites.find((s) => s.code === 'SITE-WAREHOUSE-A') ?? sites[0];
      if (!warehouse) throw new NotFoundException('Demo site not found');

      const hostUsers = await this.prisma.user.findMany({
        where: {
          organizationId: org.id,
          customerId: customer.id,
          isActive: true,
          roles: { some: { role: { code: { in: [...HOST_ROLE_CODES] } } } },
        },
        select: {
          id: true,
          fullName: true,
          roles: { select: { role: { select: { code: true } } } },
        },
        orderBy: { fullName: 'asc' },
        take: 50,
      });

      const hosts = hostUsers.map((u) => {
        const codes = u.roles.map((r) => r.role.code);
        return {
          id: u.id,
          fullName: u.fullName,
          kind: codes.includes('CUSTOMER_PORTAL')
            ? ('PORTAL' as const)
            : ('EMPLOYEE' as const),
        };
      });

      return {
        organizationId: org.id,
        customerId: customer.id,
        siteId: warehouse.id,
        customerCode: customer.code,
        siteCode: warehouse.code,
        sites,
        hosts,
        visitKinds: VISIT_KIND_OPTIONS,
      };
    });
  }

  async createOwnAppointment(
    dto: CreateVisitorAppointmentDto,
    user: AuthUser,
  ): Promise<VisitorAppointmentResponseDto> {
    if (dto.hostUserId && dto.hostUserId === user.id) {
      throw new BadRequestException({
        error: 'INVALID_HOST',
        message: 'You cannot name yourself as the host',
      });
    }
    return this.createAppointment(
      {
        ...dto,
        organizationId: user.organizationId,
        visitorName: dto.visitorName?.trim() || user.fullName,
        visitorEmail: dto.visitorEmail?.trim() || user.email,
        visitKind: dto.visitKind ?? this.defaultVisitKind(user),
      },
      user,
    );
  }

  async createAppointment(
    dto: CreateVisitorAppointmentDto,
    user?: AuthUser,
  ): Promise<VisitorAppointmentResponseDto> {
    const organizationId = user?.organizationId ?? dto.organizationId;
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    const run = () => this.persistAppointment(dto, organizationId, user);

    // Authenticated requests already run inside an RLS org context set by the
    // OrgContextInterceptor. Public pre-registration (visitor-web) has none, so
    // the customer lookup + write would be blocked by fail-closed RLS. Bind the
    // context to the org supplied in the request — scoped to THAT org only
    // (never an rls_bypass), keeping the operation tenant-isolated.
    return getOrgContext()
      ? run()
      : this.prisma.runInRequestContext({ organizationId }, run);
  }

  private async persistAppointment(
    dto: CreateVisitorAppointmentDto,
    organizationId: string,
    user?: AuthUser,
  ): Promise<VisitorAppointmentResponseDto> {
    await this.assertCustomerInOrg(dto.customerId, organizationId);
    const laneSelf = this.isVisitorLaneSelf(user);
    const requireGuestFields = !user || laneSelf;
    await this.assertVisitSite(
      dto.siteId,
      dto.customerId,
      organizationId,
      requireGuestFields,
    );

    const from = new Date(dto.validFrom);
    const until = new Date(dto.validUntil);
    if (!(until.getTime() > from.getTime())) {
      throw new BadRequestException({
        error: 'INVALID_VISIT_WINDOW',
        message: 'validUntil must be after validFrom',
      });
    }

    if (requireGuestFields) {
      const email = dto.visitorEmail?.trim();
      const phone = dto.visitorPhone?.trim();
      if (!email && !phone) {
        throw new BadRequestException({
          error: 'VISITOR_CONTACT_REQUIRED',
          message: 'Provide email or phone so the gate code can be delivered after approval',
        });
      }
    }

    if (laneSelf && user && dto.hostUserId === user.id) {
      throw new BadRequestException({
        error: 'INVALID_HOST',
        message: 'You cannot name yourself as the host',
      });
    }

    const host = await this.resolveHost({
      organizationId,
      customerId: dto.customerId,
      hostUserId: dto.hostUserId,
      hostName: dto.hostName,
      requireSelectableHost: requireGuestFields,
    });

    const idFields = this.resolveVisitorIdFields(dto.idType, dto.idNumber);
    const visitKind = dto.visitKind ?? (user && laneSelf ? this.defaultVisitKind(user) : 'VISITOR');
    const plate = dto.vehiclePlate?.trim() || null;

    const referenceNumber = await this.nextReferenceNumber(organizationId);
    const appointment = await this.prisma.visitorAppointment.create({
      data: {
        organizationId,
        customerId: dto.customerId,
        siteId: dto.siteId,
        gateId: dto.gateId,
        referenceNumber,
        visitorName: dto.visitorName.trim(),
        visitorEmail: dto.visitorEmail?.trim() || null,
        visitorPhone: dto.visitorPhone?.trim() || null,
        companyName: dto.companyName?.trim() || null,
        purpose: dto.purpose.trim(),
        visitKind,
        idType: idFields.idType,
        idNumber: idFields.idNumber,
        hostUserId: host.hostUserId,
        hostName: host.hostName,
        vehiclePlate: plate,
        validFrom: from,
        validUntil: until,
        createdBy: user?.id,
        ...(laneSelf && user ? { userId: user.id } : {}),
      },
    });

    await this.audit.record({
      organizationId,
      actorId: user?.id ?? 'public',
      action: 'visitor.appointment.created',
      resourceType: 'VisitorAppointment',
      resourceId: appointment.id,
      after: appointment,
    });

    return this.toAppointmentDto(appointment);
  }

  /** E4/E5/E6 — contractor/consultant/provider: own profile + appointment summary. */
  async getContractorMe(user: AuthUser): Promise<{
    userId: string;
    /** @deprecated use userId — kept for thin UI compat */
    contractorUserId: string;
    email: string;
    fullName: string;
    appointmentCount: number;
    appointments: VisitorAppointmentResponseDto[];
  }> {
    const appointments = await this.listContractorAppointments(user);
    return {
      userId: user.id,
      contractorUserId: user.id,
      email: user.email,
      fullName: user.fullName,
      appointmentCount: appointments.length,
      appointments,
    };
  }

  async listContractorAppointments(
    user: AuthUser,
  ): Promise<VisitorAppointmentResponseDto[]> {
    const rows = await this.prisma.visitorAppointment.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (rows.length === 0) return [];

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, code: true, name: true },
    });
    const siteById = new Map(sites.map((s) => [s.id, s]));

    return rows.map((a) => {
      const site = siteById.get(a.siteId);
      return this.toAppointmentDto(a, {
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
      });
    });
  }

  async listContractorEntries(
    user: AuthUser,
  ): Promise<VisitorEntryResponseDto[]> {
    const rows = await this.prisma.visitorEntry.findMany({
      where: {
        organizationId: user.organizationId,
        appointment: { userId: user.id },
      },
      include: {
        appointment: { select: { idType: true, idNumber: true } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    return rows.map((e) =>
      this.toEntryDto(e, {
        idType: e.appointment?.idType ?? null,
        idNumber: e.appointment?.idNumber ?? null,
      }),
    );
  }

  async listAppointments(
    user: AuthUser,
    customerId?: string,
    siteId?: string,
    status?: AppointmentStatus,
  ): Promise<VisitorAppointmentResponseDto[]> {
    const rows = await this.prisma.visitorAppointment.findMany({
      where: {
        organizationId: user.organizationId,
        ...(customerId ? { customerId } : {}),
        ...(siteId ? { siteId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (rows.length === 0) return [];

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, code: true, name: true },
    });
    const siteById = new Map(sites.map((s) => [s.id, s]));

    return rows.map((a) => {
      const site = siteById.get(a.siteId);
      return this.toAppointmentDto(a, {
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
      });
    });
  }

  async approveAppointment(
    id: string,
    user: AuthUser,
  ): Promise<IssueCodeResponseDto> {
    const appointment = await this.findAppointmentOrThrow(
      id,
      user.organizationId,
      user.customerId,
    );
    if (appointment.createdBy && appointment.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_APPROVE',
        message: 'Creator cannot approve or reject their own request',
      });
    }
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException('Only pending appointments can be approved');
    }

    const now = new Date();
    const updated = await this.prisma.visitorAppointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.APPROVED,
        approvedBy: user.id,
        approvedAt: now,
      },
    });

    const plainCode = generateVerificationCode();
    const secret = this.codeSecret();
    const codeRecord = await this.prisma.verificationCode.create({
      data: {
        appointmentId: id,
        codeHash: hashVerificationCode(plainCode, secret),
        validFrom: updated.validFrom,
        validUntil: updated.validUntil,
        siteId: updated.siteId,
        gateId: updated.gateId,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'visitor.appointment.approved',
      resourceType: 'VisitorAppointment',
      resourceId: id,
      after: { appointment: updated, codeId: codeRecord.id },
    });

    let delivery = { email: false, sms: false, whatsapp: false };
    try {
      const site = await this.prisma.site.findFirst({
        where: { id: updated.siteId },
      });
      delivery = await this.notifications.enqueueVisitorGateCode({
        organizationId: user.organizationId,
        appointmentId: id,
        visitorPhone: updated.visitorPhone,
        visitorEmail: updated.visitorEmail,
        plainCode,
        siteName: site?.name ?? updated.siteId,
        validUntil: updated.validUntil,
        actorId: user.id,
      });
      if (delivery.email || delivery.sms || delivery.whatsapp) {
        await this.audit.record({
          organizationId: user.organizationId,
          actorId: user.id,
          action: 'visitor.code.delivery_queued',
          resourceType: 'VisitorAppointment',
          resourceId: id,
          after: {
            channels: delivery,
            hasEmail: !!updated.visitorEmail?.trim(),
            hasPhone: !!updated.visitorPhone?.trim(),
          },
        });
      }
    } catch {
      // Notification enqueue must not block approval — still return the code
      delivery = { email: false, sms: false, whatsapp: false };
    }

    return {
      appointment: this.toAppointmentDto(updated),
      verificationCode: plainCode,
      validUntil: updated.validUntil,
      siteId: updated.siteId,
      gateId: updated.gateId,
      delivery,
    };
  }

  async rejectAppointment(
    id: string,
    dto: RejectAppointmentDto,
    user: AuthUser,
  ): Promise<VisitorAppointmentResponseDto> {
    const appointment = await this.findAppointmentOrThrow(
      id,
      user.organizationId,
      user.customerId,
    );
    if (appointment.createdBy && appointment.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_APPROVE',
        message: 'Creator cannot approve or reject their own request',
      });
    }
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException('Only pending appointments can be rejected');
    }

    const updated = await this.prisma.visitorAppointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.REJECTED,
        rejectedReason: dto.reason,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'visitor.appointment.rejected',
      resourceType: 'VisitorAppointment',
      resourceId: id,
      after: updated,
    });

    return this.toAppointmentDto(updated);
  }

  async gateVerify(
    dto: GateVerifyDto,
    user: AuthUser,
  ): Promise<GateVerifyResponseDto> {
    this.assertGateVerifyRateLimit(user.id, dto.siteId);

    if (dto.clientEventId) {
      const existing = await this.prisma.visitorEntry.findUnique({
        where: { clientEventId: dto.clientEventId },
        include: {
          appointment: { select: { idType: true, idNumber: true } },
        },
      });
      if (existing) {
        const idType = existing.appointment?.idType ?? null;
        const idNumber = existing.appointment?.idNumber ?? null;
        return {
          allowed: existing.result === VerificationResult.ALLOWED,
          result: existing.result,
          entry: this.toEntryDto(existing, { idType, idNumber }),
          fieldAlertId: null,
          hostNotified: null,
          idType,
          idNumber,
        };
      }
    }

    await this.assertSiteAndGateForOrg(dto.siteId, dto.gateId, user.organizationId);

    const secret = this.codeSecret();
    const now = new Date();
    let result: VerificationResult = VerificationResult.DENIED_INVALID;
    let denyReason: string | undefined;
    let appointmentId: string | undefined;
    let verificationCodeId: string | undefined;
    let visitorName = 'Unknown';
    let matchedIdType: VisitorIdType | null = null;
    let matchedIdNumber: string | null = null;
    let allowMatched: {
      id: string;
      appointmentId: string;
      maxUses: number;
      visitorName: string;
      idType: VisitorIdType | null;
      idNumber: string | null;
    } | null = null;

    const blacklistOr: { visitorPhone?: string; visitorEmail?: string }[] = [];
    if (dto.visitorPhone) blacklistOr.push({ visitorPhone: dto.visitorPhone });
    if (dto.visitorEmail) blacklistOr.push({ visitorEmail: dto.visitorEmail });

    const blacklisted =
      blacklistOr.length > 0
        ? await this.prisma.visitorBlacklist.findFirst({
            where: {
              organizationId: user.organizationId,
              isActive: true,
              OR: blacklistOr,
            },
          })
        : null;

    if (blacklisted) {
      result = VerificationResult.DENIED_BLACKLISTED;
      denyReason = blacklisted.reason;
    } else {
      // HMAC is deterministic — look up by hash (also pull revoked/expired for typed denies)
      const matched = await this.prisma.verificationCode.findFirst({
        where: {
          codeHash: hashVerificationCode(dto.code, secret),
          siteId: dto.siteId,
          appointment: { organizationId: user.organizationId },
        },
        include: { appointment: true },
      });

      if (!matched) {
        result = VerificationResult.DENIED_INVALID;
        denyReason = 'Invalid verification code';
      } else if (matched.revokedAt) {
        result = VerificationResult.DENIED_REVOKED;
        denyReason = 'Code revoked';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
        matchedIdType = matched.appointment.idType;
        matchedIdNumber = matched.appointment.idNumber;
      } else if (now < matched.validFrom || now > matched.validUntil) {
        result = VerificationResult.DENIED_EXPIRED;
        denyReason = 'Code expired or not yet valid';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
        matchedIdType = matched.appointment.idType;
        matchedIdNumber = matched.appointment.idNumber;
      } else if (matched.siteId !== dto.siteId) {
        result = VerificationResult.DENIED_SITE_MISMATCH;
        denyReason = 'Code not valid for this site';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
        matchedIdType = matched.appointment.idType;
        matchedIdNumber = matched.appointment.idNumber;
      } else if (matched.gateId && dto.gateId && matched.gateId !== dto.gateId) {
        result = VerificationResult.DENIED_GATE_MISMATCH;
        denyReason = 'Code not valid for this gate';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
        matchedIdType = matched.appointment.idType;
        matchedIdNumber = matched.appointment.idNumber;
      } else if (matched.useCount >= matched.maxUses) {
        result = VerificationResult.DENIED_ALREADY_USED;
        denyReason = 'Code already used';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
        matchedIdType = matched.appointment.idType;
        matchedIdNumber = matched.appointment.idNumber;
      } else if (matched.appointment.status !== AppointmentStatus.APPROVED) {
        result = VerificationResult.DENIED_INVALID;
        denyReason = 'Appointment not approved';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
        matchedIdType = matched.appointment.idType;
        matchedIdNumber = matched.appointment.idNumber;
      } else {
        allowMatched = {
          id: matched.id,
          appointmentId: matched.appointmentId,
          maxUses: matched.maxUses,
          visitorName: matched.appointment.visitorName,
          idType: matched.appointment.idType,
          idNumber: matched.appointment.idNumber,
        };
        matchedIdType = matched.appointment.idType;
        matchedIdNumber = matched.appointment.idNumber;
      }
    }

    let entry;

    if (allowMatched) {
      const code = allowMatched;
      entry = await this.prisma.$transaction(async (tx) => {
        const consumed = await tx.verificationCode.updateMany({
          where: {
            id: code.id,
            useCount: { lt: code.maxUses },
            revokedAt: null,
          },
          data: {
            useCount: { increment: 1 },
            usedAt: now,
          },
        });

        if (consumed.count === 0) {
          return tx.visitorEntry.create({
            data: {
              organizationId: user.organizationId,
              appointmentId: code.appointmentId,
              siteId: dto.siteId,
              gateId: dto.gateId,
              visitorName: code.visitorName,
              verificationCodeId: code.id,
              result: VerificationResult.DENIED_ALREADY_USED,
              direction: VisitorEntryDirection.IN,
              denyReason: 'Code already used',
              verifiedBy: user.id,
              clientEventId: dto.clientEventId,
            },
          });
        }

        // Module 12-B — keep APPROVED until exit punch completes the visit
        return tx.visitorEntry.create({
          data: {
            organizationId: user.organizationId,
            appointmentId: code.appointmentId,
            siteId: dto.siteId,
            gateId: dto.gateId,
            visitorName: code.visitorName,
            verificationCodeId: code.id,
            result: VerificationResult.ALLOWED,
            direction: VisitorEntryDirection.IN,
            denyReason: null,
            verifiedBy: user.id,
            clientEventId: dto.clientEventId,
          },
        });
      });
    } else {
      entry = await this.prisma.visitorEntry.create({
        data: {
          organizationId: user.organizationId,
          appointmentId,
          siteId: dto.siteId,
          gateId: dto.gateId,
          visitorName,
          verificationCodeId,
          result,
          direction: VisitorEntryDirection.IN,
          denyReason,
          verifiedBy: user.id,
          clientEventId: dto.clientEventId,
        },
      });
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action:
        entry.result === VerificationResult.ALLOWED
          ? 'visitor.gate.allowed'
          : 'visitor.gate.denied',
      resourceType: 'VisitorEntry',
      resourceId: entry.id,
      after: entry,
    });

    // Module 12-A — deny → FieldAlert for Supervisor → Field → BOM → Control
    let fieldAlertId: string | null = null;
    let hostNotified: GateDenyHostNotifiedDto | null = null;
    if (entry.result !== VerificationResult.ALLOWED) {
      fieldAlertId = await this.raiseGateDenyFieldAlert({
        organizationId: user.organizationId,
        siteId: dto.siteId,
        entryId: entry.id,
        result: entry.result,
        denyReason: entry.denyReason,
        visitorName: entry.visitorName,
        appointmentId: entry.appointmentId,
        verifiedBy: user.id,
      });
      // Module 12-E — host SMS/EMAIL only when appointmentId known (matched code)
      hostNotified = await this.notifyHostOnGateDeny({
        organizationId: user.organizationId,
        siteId: dto.siteId,
        entryId: entry.id,
        result: entry.result,
        denyReason: entry.denyReason,
        visitorName: entry.visitorName,
        appointmentId: entry.appointmentId,
        verifiedBy: user.id,
      });
    }

    return {
      allowed: entry.result === VerificationResult.ALLOWED,
      result: entry.result,
      entry: this.toEntryDto(entry, {
        idType: matchedIdType,
        idNumber: matchedIdNumber,
      }),
      fieldAlertId,
      hostNotified,
      idType: matchedIdType,
      idNumber: matchedIdNumber,
    };
  }

  /**
   * Module 12-B — gate exit punch. Lookup by appointment / reference / used code /
   * IN entry; creates ALLOWED OUT; marks appointment COMPLETED. No FieldAlert.
   */
  async gateExit(
    dto: GateExitDto,
    user: AuthUser,
  ): Promise<GateExitResponseDto> {
    this.assertGateVerifyRateLimit(user.id, dto.siteId);

    if (dto.clientEventId) {
      const existing = await this.prisma.visitorEntry.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (existing) {
        if (existing.direction !== VisitorEntryDirection.OUT) {
          throw new BadRequestException({
            error: 'INVALID_IDEMPOTENCY_KEY',
            message: 'clientEventId already used for a non-exit entry',
          });
        }
        return {
          allowed: existing.result === VerificationResult.ALLOWED,
          exited: true,
          result: existing.result,
          entry: this.toEntryDto(existing),
        };
      }
    }

    const hasLookup =
      !!dto.appointmentId ||
      !!dto.referenceNumber?.trim() ||
      !!dto.verificationCode?.trim() ||
      !!dto.entryId;
    if (!hasLookup) {
      throw new BadRequestException({
        error: 'EXIT_LOOKUP_REQUIRED',
        message:
          'Provide appointmentId, referenceNumber, verificationCode, or entryId',
      });
    }

    await this.assertSiteAndGateForOrg(dto.siteId, dto.gateId, user.organizationId);

    const appointmentId = await this.resolveExitAppointmentId(dto, user);
    if (!appointmentId) {
      throw new BadRequestException({
        error: 'NO_OPEN_VISIT',
        message: 'No matching open visit found for exit',
      });
    }

    const appointment = await this.prisma.visitorAppointment.findFirst({
      where: {
        id: appointmentId,
        organizationId: user.organizationId,
        siteId: dto.siteId,
        status: {
          in: [AppointmentStatus.APPROVED, AppointmentStatus.COMPLETED],
        },
      },
    });
    if (!appointment) {
      throw new BadRequestException({
        error: 'NO_OPEN_VISIT',
        message: 'No matching open visit found for exit',
      });
    }

    const openIn = await this.prisma.visitorEntry.findFirst({
      where: {
        organizationId: user.organizationId,
        appointmentId: appointment.id,
        siteId: dto.siteId,
        result: VerificationResult.ALLOWED,
        direction: VisitorEntryDirection.IN,
      },
      orderBy: { recordedAt: 'desc' },
    });
    if (!openIn) {
      throw new BadRequestException({
        error: 'NO_OPEN_VISIT',
        message: 'No ALLOWED entry punch found for this visit at site',
      });
    }

    const alreadyOut = await this.prisma.visitorEntry.findFirst({
      where: {
        organizationId: user.organizationId,
        appointmentId: appointment.id,
        siteId: dto.siteId,
        result: VerificationResult.ALLOWED,
        direction: VisitorEntryDirection.OUT,
        recordedAt: { gte: openIn.recordedAt },
      },
      orderBy: { recordedAt: 'desc' },
    });
    if (alreadyOut) {
      throw new BadRequestException({
        error: 'ALREADY_EXITED',
        message: 'Visitor already has an exit punch for this visit',
      });
    }

    const entry = await this.prisma.$transaction(async (tx) => {
      const out = await tx.visitorEntry.create({
        data: {
          organizationId: user.organizationId,
          appointmentId: appointment.id,
          siteId: dto.siteId,
          gateId: dto.gateId,
          visitorName: appointment.visitorName,
          verificationCodeId: openIn.verificationCodeId,
          result: VerificationResult.ALLOWED,
          direction: VisitorEntryDirection.OUT,
          denyReason: null,
          verifiedBy: user.id,
          clientEventId: dto.clientEventId,
        },
      });

      await tx.visitorAppointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.COMPLETED },
      });

      return out;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'visitor.gate.exited',
      resourceType: 'VisitorEntry',
      resourceId: entry.id,
      after: {
        entry,
        appointmentId: appointment.id,
        inEntryId: openIn.id,
      },
    });

    return {
      allowed: true,
      exited: true,
      result: VerificationResult.ALLOWED,
      entry: this.toEntryDto(entry),
    };
  }

  /** Resolve appointment id from one of the Module 12-B exit lookup keys. */
  private async resolveExitAppointmentId(
    dto: GateExitDto,
    user: AuthUser,
  ): Promise<string | null> {
    if (dto.appointmentId) {
      return dto.appointmentId;
    }

    if (dto.entryId) {
      const inEntry = await this.prisma.visitorEntry.findFirst({
        where: {
          id: dto.entryId,
          organizationId: user.organizationId,
          siteId: dto.siteId,
          result: VerificationResult.ALLOWED,
          direction: VisitorEntryDirection.IN,
        },
      });
      return inEntry?.appointmentId ?? null;
    }

    if (dto.referenceNumber?.trim()) {
      const appt = await this.prisma.visitorAppointment.findFirst({
        where: {
          organizationId: user.organizationId,
          referenceNumber: dto.referenceNumber.trim(),
          siteId: dto.siteId,
        },
        select: { id: true },
      });
      return appt?.id ?? null;
    }

    if (dto.verificationCode?.trim()) {
      const secret = this.codeSecret();
      const code = dto.verificationCode.trim().replace(/\s+/g, '').toUpperCase();
      const matched = await this.prisma.verificationCode.findFirst({
        where: {
          codeHash: hashVerificationCode(code, secret),
          siteId: dto.siteId,
          appointment: { organizationId: user.organizationId },
        },
        select: { appointmentId: true },
      });
      return matched?.appointmentId ?? null;
    }

    return null;
  }

  /**
   * Module 12-A — alert responsible ops officers on gate deny (design §12).
   * Uses shared FieldAlert ladder (SUPERVISOR initial); no Nest cycle into Attendance.
   */
  private async raiseGateDenyFieldAlert(params: {
    organizationId: string;
    siteId: string;
    entryId: string;
    result: VerificationResult;
    denyReason: string | null;
    visitorName: string;
    appointmentId: string | null;
    verifiedBy: string;
  }): Promise<string> {
    const high = new Set<VerificationResult>([
      VerificationResult.DENIED_BLACKLISTED,
      VerificationResult.DENIED_REVOKED,
      VerificationResult.DENIED_ALREADY_USED,
    ]);
    const severity = high.has(params.result) ? 'HIGH' : 'MEDIUM';
    const reason = params.denyReason?.trim() || params.result;
    const message = `Visitor gate denied (${params.result}): ${params.visitorName} — ${reason}`;

    const alert = await this.prisma.fieldAlert.create({
      data: {
        organizationId: params.organizationId,
        siteId: params.siteId,
        alertType: VISITOR_GATE_DENIED_ALERT,
        severity,
        message,
        escalationStage: 'SUPERVISOR',
      },
    });

    await this.outbox.write({
      organizationId: params.organizationId,
      eventType: 'field.alert.created',
      aggregateType: 'VisitorEntry',
      aggregateId: params.entryId,
      payload: {
        siteId: params.siteId,
        alertType: VISITOR_GATE_DENIED_ALERT,
        fieldAlertId: alert.id,
        result: params.result,
        visitorName: params.visitorName,
        appointmentId: params.appointmentId,
        verifiedBy: params.verifiedBy,
      },
      idempotencyKey: `visitor-gate-deny-${params.entryId}`,
    });

    await this.audit.record({
      organizationId: params.organizationId,
      actorId: params.verifiedBy,
      action: 'visitor.gate.deny_alerted',
      resourceType: 'FieldAlert',
      resourceId: alert.id,
      after: {
        entryId: params.entryId,
        alertType: VISITOR_GATE_DENIED_ALERT,
        severity,
        result: params.result,
      },
    });

    return alert.id;
  }

  /**
   * Module 12-E — notify host (User phone/email) when deny matches a known appointment.
   * Unknown/invalid codes with no appointmentId → null (FieldAlert only from 12-A).
   * Blacklist without appointmentId → null.
   */
  private async notifyHostOnGateDeny(params: {
    organizationId: string;
    siteId: string;
    entryId: string;
    result: VerificationResult;
    denyReason: string | null;
    visitorName: string;
    appointmentId: string | null;
    verifiedBy: string;
  }): Promise<GateDenyHostNotifiedDto | null> {
    if (!params.appointmentId) {
      return null;
    }

    const appointment = await this.prisma.visitorAppointment.findFirst({
      where: {
        id: params.appointmentId,
        organizationId: params.organizationId,
      },
      select: {
        id: true,
        hostUserId: true,
        referenceNumber: true,
      },
    });
    if (!appointment?.hostUserId) {
      return { sms: false, email: false };
    }

    const host = await this.prisma.user.findFirst({
      where: {
        id: appointment.hostUserId,
        organizationId: params.organizationId,
      },
      select: { id: true, phone: true, email: true },
    });
    if (!host) {
      return { sms: false, email: false };
    }

    const site = await this.prisma.site.findFirst({
      where: { id: params.siteId, organizationId: params.organizationId },
      select: { name: true },
    });

    let delivery = { sms: false, email: false };
    try {
      delivery = await this.notifications.enqueueVisitorGateDeniedHost({
        organizationId: params.organizationId,
        entryId: params.entryId,
        appointmentId: appointment.id,
        hostPhone: host.phone,
        hostEmail: host.email,
        visitorName: params.visitorName,
        result: params.result,
        denyReason: params.denyReason,
        siteName: site?.name ?? params.siteId,
        referenceNumber: appointment.referenceNumber,
        actorId: params.verifiedBy,
      });
    } catch {
      return { sms: false, email: false };
    }

    if (delivery.sms || delivery.email) {
      await this.audit.record({
        organizationId: params.organizationId,
        actorId: params.verifiedBy,
        action: 'visitor.gate.host_notified',
        resourceType: 'VisitorEntry',
        resourceId: params.entryId,
        after: {
          appointmentId: appointment.id,
          hostUserId: host.id,
          channels: delivery,
          result: params.result,
        },
      });
    }

    return delivery;
  }

  async listEntries(
    user: AuthUser,
    siteId?: string,
  ): Promise<VisitorEntryResponseDto[]> {
    const rows = await this.prisma.visitorEntry.findMany({
      where: {
        organizationId: user.organizationId,
        ...(siteId ? { siteId } : {}),
      },
      include: {
        appointment: { select: { idType: true, idNumber: true } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    return rows.map((e) =>
      this.toEntryDto(e, {
        idType: e.appointment?.idType ?? null,
        idNumber: e.appointment?.idNumber ?? null,
      }),
    );
  }

  private assertGateVerifyRateLimit(userId: string, siteId: string): void {
    const key = `${userId}:${siteId}`;
    const now = Date.now();
    const windowStart = now - GATE_VERIFY_WINDOW_MS;
    const recent = (this.gateVerifyAttempts.get(key) ?? []).filter(
      (ts) => ts > windowStart,
    );
    if (recent.length >= GATE_VERIFY_RATE_LIMIT) {
      throw new HttpException(
        'Too many verification attempts. Try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.gateVerifyAttempts.set(key, recent);
  }

  private async assertSiteAndGateForOrg(
    siteId: string,
    gateId: string | undefined,
    organizationId: string,
  ): Promise<void> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, organizationId },
    });
    if (!site) {
      throw new ForbiddenException('Site not found in your organization');
    }
    if (gateId) {
      const gate = await this.prisma.gate.findFirst({
        where: { id: gateId, siteId, organizationId },
      });
      if (!gate) {
        throw new BadRequestException('Gate does not belong to this site');
      }
    }
  }

  private codeSecret(): string {
    return (
      this.config.get<string>('VISITOR_CODE_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'pssms-dev-visitor-code-secret'
    );
  }

  private async nextReferenceNumber(organizationId: string): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `VIS-${date}-`;
    const count = await this.prisma.visitorAppointment.count({
      where: {
        organizationId,
        referenceNumber: { startsWith: prefix },
      },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async findAppointmentOrThrow(
    id: string,
    organizationId: string,
    customerId?: string | null,
  ) {
    const appointment = await this.prisma.visitorAppointment.findFirst({
      where: {
        id,
        organizationId,
        ...(customerId ? { customerId } : {}),
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  private isVisitorLaneSelf(user?: AuthUser): boolean {
    if (!user) return false;
    return (
      isContractorSelfScoped(user) ||
      isConsultantSelfScoped(user) ||
      isServiceProviderSelfScoped(user)
    );
  }

  private defaultVisitKind(user: AuthUser): VisitKind {
    if (isContractorSelfScoped(user)) return 'CONTRACTOR';
    if (isConsultantSelfScoped(user)) return 'CONSULTANT';
    if (isServiceProviderSelfScoped(user)) return 'SUPPLIER_VISIT';
    return 'VISITOR';
  }

  private async assertVisitSite(
    siteId: string,
    customerId: string,
    organizationId: string,
    requireCustomerSite: boolean,
  ): Promise<void> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, organizationId, isActive: true },
    });
    if (!site) {
      throw new BadRequestException({
        error: 'INVALID_SITE',
        message: 'Site not found in this organisation',
      });
    }
    if (requireCustomerSite) {
      if (site.customerId !== customerId) {
        throw new BadRequestException({
          error: 'INVALID_SITE',
          message: 'Site does not belong to this customer',
        });
      }
    } else if (site.customerId && site.customerId !== customerId) {
      throw new BadRequestException({
        error: 'INVALID_SITE',
        message: 'Site does not belong to this customer',
      });
    }
  }

  private async resolveHost(params: {
    organizationId: string;
    customerId: string;
    hostUserId?: string;
    hostName?: string;
    requireSelectableHost: boolean;
  }): Promise<{ hostUserId: string | null; hostName: string | null }> {
    if (params.requireSelectableHost && !params.hostUserId) {
      throw new BadRequestException({
        error: 'HOST_REQUIRED',
        message: 'Select the host you are visiting',
      });
    }
    const trimmedName = params.hostName?.trim() || null;
    if (params.hostUserId) {
      const host = await this.prisma.user.findFirst({
        where: {
          id: params.hostUserId,
          organizationId: params.organizationId,
          customerId: params.customerId,
          isActive: true,
          roles: { some: { role: { code: { in: [...HOST_ROLE_CODES] } } } },
        },
        select: { id: true, fullName: true },
      });
      if (!host) {
        throw new BadRequestException({
          error: 'INVALID_HOST',
          message: 'Host is not a selectable contact for this customer',
        });
      }
      return { hostUserId: host.id, hostName: host.fullName };
    }
    return { hostUserId: null, hostName: trimmedName };
  }

  private async assertCustomerInOrg(
    customerId: string,
    organizationId: string,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) {
      throw new ForbiddenException('Customer not found in your organization');
    }
  }

  /** Module 12-D — both idType + idNumber, or neither. */
  private resolveVisitorIdFields(
    idType?: VisitorIdType | null,
    idNumber?: string | null,
  ): { idType: VisitorIdType | null; idNumber: string | null } {
    const trimmed = typeof idNumber === 'string' ? idNumber.trim() : '';
    const hasType = idType != null;
    const hasNumber = trimmed.length > 0;
    if (hasType !== hasNumber) {
      throw new BadRequestException({
        error: 'ID_INCOMPLETE',
        message: 'idType and idNumber must both be provided, or neither',
      });
    }
    if (!hasType) {
      return { idType: null, idNumber: null };
    }
    if (trimmed.length > 64) {
      throw new BadRequestException({
        error: 'ID_NUMBER_TOO_LONG',
        message: 'idNumber must be at most 64 characters',
      });
    }
    return { idType, idNumber: trimmed };
  }

  private toAppointmentDto(
    a: {
      id: string;
      organizationId: string;
      customerId: string;
      siteId: string;
      gateId: string | null;
      referenceNumber: string;
      visitorName: string;
      visitorEmail: string | null;
      visitorPhone: string | null;
      companyName: string | null;
      purpose: string;
      visitKind?: string;
      idType?: VisitorIdType | null;
      idNumber?: string | null;
      hostUserId: string | null;
      hostName: string | null;
      vehiclePlate: string | null;
      validFrom: Date;
      validUntil: Date;
      status: AppointmentStatus;
      approvedBy: string | null;
      approvedAt: Date | null;
      rejectedReason: string | null;
      createdAt: Date;
    },
    labels?: { siteCode?: string | null; siteName?: string | null },
  ): VisitorAppointmentResponseDto {
    return {
      id: a.id,
      organizationId: a.organizationId,
      customerId: a.customerId,
      siteId: a.siteId,
      gateId: a.gateId,
      referenceNumber: a.referenceNumber,
      visitorName: a.visitorName,
      visitorEmail: a.visitorEmail,
      visitorPhone: a.visitorPhone,
      companyName: a.companyName,
      purpose: a.purpose,
      visitKind: a.visitKind ?? 'VISITOR',
      idType: a.idType ?? null,
      idNumber: a.idNumber ?? null,
      hostUserId: a.hostUserId,
      hostName: a.hostName,
      vehiclePlate: a.vehiclePlate,
      validFrom: a.validFrom,
      validUntil: a.validUntil,
      status: a.status,
      approvedBy: a.approvedBy,
      approvedAt: a.approvedAt,
      rejectedReason: a.rejectedReason,
      createdAt: a.createdAt,
      siteCode: labels?.siteCode ?? null,
      siteName: labels?.siteName ?? null,
    };
  }

  private toEntryDto(
    e: {
      id: string;
      organizationId: string;
      appointmentId: string | null;
      siteId: string;
      gateId: string | null;
      visitorName: string;
      result: VerificationResult;
      direction?: VisitorEntryDirection | null;
      denyReason: string | null;
      verifiedBy: string | null;
      recordedAt: Date;
      createdAt: Date;
    },
    id?: { idType?: VisitorIdType | null; idNumber?: string | null },
  ): VisitorEntryResponseDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      appointmentId: e.appointmentId,
      siteId: e.siteId,
      gateId: e.gateId,
      visitorName: e.visitorName,
      result: e.result,
      direction: e.direction ?? VisitorEntryDirection.IN,
      denyReason: e.denyReason,
      verifiedBy: e.verifiedBy,
      recordedAt: e.recordedAt,
      createdAt: e.createdAt,
      idType: id?.idType ?? null,
      idNumber: id?.idNumber ?? null,
    };
  }
}
