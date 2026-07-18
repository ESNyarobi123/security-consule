import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentStatus, VerificationResult } from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  generateVerificationCode,
  hashVerificationCode,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { NotificationsService } from '@pssms/notifications';
import {
  CreateVisitorAppointmentDto,
  GateVerifyDto,
  GateVerifyResponseDto,
  IssueCodeResponseDto,
  RejectAppointmentDto,
  VisitorAppointmentResponseDto,
  VisitorEntryResponseDto,
} from '../presentation/dto/visitor.dto';

/** Light in-memory gate-verify rate limit: max attempts per user+site window. */
const GATE_VERIFY_RATE_LIMIT = 30;
const GATE_VERIFY_WINDOW_MS = 60_000;

@Injectable()
export class VisitorsService {
  private readonly gateVerifyAttempts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async publicConfig(): Promise<{
    organizationId: string;
    customerId: string;
    siteId: string;
    customerCode: string;
    siteCode: string;
  }> {
    const org = await this.prisma.organization.findFirst({
      where: { code: 'HIGHLINK' },
    });
    if (!org) throw new NotFoundException('Demo organization not found');

    const customer = await this.prisma.customer.findFirst({
      where: { organizationId: org.id, code: 'CUST-DEMO' },
    });
    if (!customer) throw new NotFoundException('Demo customer not found');

    const site = await this.prisma.site.findFirst({
      where: { organizationId: org.id, code: 'SITE-WAREHOUSE-A' },
    });
    if (!site) throw new NotFoundException('Demo site not found');

    return {
      organizationId: org.id,
      customerId: customer.id,
      siteId: site.id,
      customerCode: customer.code,
      siteCode: site.code,
    };
  }

  async createAppointment(
    dto: CreateVisitorAppointmentDto,
    user?: AuthUser,
  ): Promise<VisitorAppointmentResponseDto> {
    const organizationId = user?.organizationId ?? dto.organizationId;
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    await this.assertCustomerInOrg(dto.customerId, organizationId);

    const referenceNumber = await this.nextReferenceNumber(organizationId);
    const appointment = await this.prisma.visitorAppointment.create({
      data: {
        organizationId,
        customerId: dto.customerId,
        siteId: dto.siteId,
        gateId: dto.gateId,
        referenceNumber,
        visitorName: dto.visitorName,
        visitorEmail: dto.visitorEmail,
        visitorPhone: dto.visitorPhone,
        companyName: dto.companyName,
        purpose: dto.purpose,
        hostUserId: dto.hostUserId ?? user?.id,
        hostName: dto.hostName,
        vehiclePlate: dto.vehiclePlate,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        createdBy: user?.id,
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
    return rows.map((a) => this.toAppointmentDto(a));
  }

  async approveAppointment(
    id: string,
    user: AuthUser,
  ): Promise<IssueCodeResponseDto> {
    const appointment = await this.findAppointmentOrThrow(id, user.organizationId);
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

    if (updated.visitorPhone) {
      try {
        const site = await this.prisma.site.findFirst({
          where: { id: updated.siteId },
        });
        await this.notifications.enqueueVisitorGateCode({
          organizationId: user.organizationId,
          appointmentId: id,
          visitorPhone: updated.visitorPhone,
          plainCode,
          siteName: site?.name ?? updated.siteId,
          validUntil: updated.validUntil,
          actorId: user.id,
        });
      } catch {
        // Notification enqueue must not block approval response
      }
    }

    return {
      appointment: this.toAppointmentDto(updated),
      verificationCode: plainCode,
      validUntil: updated.validUntil,
      siteId: updated.siteId,
      gateId: updated.gateId,
    };
  }

  async rejectAppointment(
    id: string,
    dto: RejectAppointmentDto,
    user: AuthUser,
  ): Promise<VisitorAppointmentResponseDto> {
    const appointment = await this.findAppointmentOrThrow(id, user.organizationId);
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
      });
      if (existing) {
        return {
          allowed: existing.result === VerificationResult.ALLOWED,
          result: existing.result,
          entry: this.toEntryDto(existing),
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
    let allowMatched: {
      id: string;
      appointmentId: string;
      maxUses: number;
      visitorName: string;
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
      } else if (now < matched.validFrom || now > matched.validUntil) {
        result = VerificationResult.DENIED_EXPIRED;
        denyReason = 'Code expired or not yet valid';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
      } else if (matched.siteId !== dto.siteId) {
        result = VerificationResult.DENIED_SITE_MISMATCH;
        denyReason = 'Code not valid for this site';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
      } else if (matched.gateId && dto.gateId && matched.gateId !== dto.gateId) {
        result = VerificationResult.DENIED_GATE_MISMATCH;
        denyReason = 'Code not valid for this gate';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
      } else if (matched.useCount >= matched.maxUses) {
        result = VerificationResult.DENIED_ALREADY_USED;
        denyReason = 'Code already used';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
      } else if (matched.appointment.status !== AppointmentStatus.APPROVED) {
        result = VerificationResult.DENIED_INVALID;
        denyReason = 'Appointment not approved';
        appointmentId = matched.appointmentId;
        verificationCodeId = matched.id;
        visitorName = matched.appointment.visitorName;
      } else {
        allowMatched = {
          id: matched.id,
          appointmentId: matched.appointmentId,
          maxUses: matched.maxUses,
          visitorName: matched.appointment.visitorName,
        };
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
              denyReason: 'Code already used',
              verifiedBy: user.id,
              clientEventId: dto.clientEventId,
            },
          });
        }

        await tx.visitorAppointment.update({
          where: { id: code.appointmentId },
          data: { status: AppointmentStatus.COMPLETED },
        });

        return tx.visitorEntry.create({
          data: {
            organizationId: user.organizationId,
            appointmentId: code.appointmentId,
            siteId: dto.siteId,
            gateId: dto.gateId,
            visitorName: code.visitorName,
            verificationCodeId: code.id,
            result: VerificationResult.ALLOWED,
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

    return {
      allowed: entry.result === VerificationResult.ALLOWED,
      result: entry.result,
      entry: this.toEntryDto(entry),
    };
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
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    return rows.map((e) => this.toEntryDto(e));
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

  private async findAppointmentOrThrow(id: string, organizationId: string) {
    const appointment = await this.prisma.visitorAppointment.findFirst({
      where: { id, organizationId },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
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

  private toAppointmentDto(a: {
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
  }): VisitorAppointmentResponseDto {
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
    };
  }

  private toEntryDto(e: {
    id: string;
    organizationId: string;
    appointmentId: string | null;
    siteId: string;
    gateId: string | null;
    visitorName: string;
    result: VerificationResult;
    denyReason: string | null;
    verifiedBy: string | null;
    recordedAt: Date;
    createdAt: Date;
  }): VisitorEntryResponseDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      appointmentId: e.appointmentId,
      siteId: e.siteId,
      gateId: e.gateId,
      visitorName: e.visitorName,
      result: e.result,
      denyReason: e.denyReason,
      verifiedBy: e.verifiedBy,
      recordedAt: e.recordedAt,
      createdAt: e.createdAt,
    };
  }
}
