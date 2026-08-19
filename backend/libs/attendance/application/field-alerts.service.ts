import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  AuthUser,
  assertSiteAccess,
  isGuardSelfScoped,
  siteScopeWhere,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { GuardsService } from '@pssms/workforce';
import { OutboxWriterService } from '@pssms/notifications';
import { DeploymentStatus } from '@prisma/client';
import {
  CreateGuardEmergencyDto,
  FieldAlertResponseDto,
} from '../presentation/dto/attendance.dto';
import {
  canEscalateFieldAlertStage,
  nextFieldAlertEscalationStage,
  FIELD_ALERT_ESCALATION_INITIAL,
  GUARD_EMERGENCY_ALERT_TYPE,
  type FieldAlertEscalationStage,
} from '../domain/field-alert.constants';

const SEVERITY_RANK: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

/** Staff roles that may escalate/ack despite also holding GUARD. */
const FIELD_ALERT_SUPERVISE_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'HR_OFFICER',
  'SUPERVISOR',
  'FIELD_OFFICER',
  'BRANCH_MANAGER',
  'OPERATIONS_MANAGER',
  'CONTROL_ROOM',
  'DEVELOPER',
  'CEO',
  'CMD',
  'LEGAL',
  'MARKETING',
]);

@Injectable()
export class FieldAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly guards: GuardsService,
    private readonly outbox: OutboxWriterService,
  ) {}

  /**
   * Escalate + acknowledge require a positive supervise role allowlist
   * (not merely operations.manage — CCTV_OPERATOR must not ack AL1).
   */
  private assertCanSuperviseFieldAlert(user: AuthUser): void {
    if (!user.roles.some((r) => FIELD_ALERT_SUPERVISE_ROLES.has(r))) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Role cannot escalate or acknowledge field alerts',
      });
    }
  }

  async list(
    organizationId: string,
    user: AuthUser,
    siteId?: string,
    acknowledged?: boolean,
    escalationStage?: FieldAlertEscalationStage,
  ): Promise<FieldAlertResponseDto[]> {
    let selfGuardId: string | undefined;
    if (isGuardSelfScoped(user)) {
      const self = await this.guards.getByUserId(user.id, organizationId);
      if (!self) {
        throw new ForbiddenException({
          error: 'GUARD_SCOPE_DENIED',
          message: 'No guard profile linked to this user',
        });
      }
      selfGuardId = self.id;
    }

    const rows = await this.prisma.fieldAlert.findMany({
      where: {
        organizationId,
        ...(selfGuardId
          ? { guardId: selfGuardId }
          : siteScopeWhere(user, siteId)),
        ...(typeof acknowledged === 'boolean' ? { acknowledged } : {}),
        ...(escalationStage ? { escalationStage } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    rows.sort((a, b) => {
      const ra = SEVERITY_RANK[a.severity] ?? 9;
      const rb = SEVERITY_RANK[b.severity] ?? 9;
      if (ra !== rb) return ra - rb;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return rows.map((r) => this.toDto(r));
  }

  async raiseGuardEmergency(
    dto: CreateGuardEmergencyDto,
    user: AuthUser,
  ): Promise<FieldAlertResponseDto> {
    const guard = await this.guards.getByUserId(user.id, user.organizationId);
    if (!guard) {
      throw new BadRequestException({
        error: 'NOT_A_GUARD',
        message: 'No guard profile is linked to this login',
      });
    }

    let siteId = dto.siteId?.trim() || undefined;
    if (!siteId) {
      const deployment = await this.prisma.guardDeployment.findFirst({
        where: {
          organizationId: user.organizationId,
          guardId: guard.id,
          status: DeploymentStatus.ACTIVE,
        },
        orderBy: { startDate: 'desc' },
        select: { siteId: true },
      });
      siteId = deployment?.siteId;
    }
    if (!siteId && user.allowedSiteIds[0]) {
      siteId = user.allowedSiteIds[0];
    }
    if (!siteId) {
      throw new BadRequestException({
        error: 'SITE_REQUIRED',
        message: 'No assigned site for this emergency',
      });
    }

    const site = await this.prisma.site.findFirst({
      where: { id: siteId, organizationId: user.organizationId },
      select: { id: true, code: true, name: true },
    });
    if (!site) throw new NotFoundException('Site not found');
    assertSiteAccess(user, site.id);

    const since = new Date(Date.now() - 5 * 60 * 1000);
    const recent = await this.prisma.fieldAlert.findFirst({
      where: {
        organizationId: user.organizationId,
        guardId: guard.id,
        alertType: GUARD_EMERGENCY_ALERT_TYPE,
        acknowledged: false,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) return this.toDto(recent);

    const gps = dto.gps
      ? ` GPS ${dto.gps.latitude.toFixed(5)}, ${dto.gps.longitude.toFixed(5)}.`
      : '';
    const custom = dto.message?.trim();
    const message =
      custom && custom.length > 0
        ? custom
        : `EMERGENCY from ${guard.employeeNumber} at ${site.code}.${gps} Contact supervisor immediately.`;

    const alert = await this.prisma.fieldAlert.create({
      data: {
        organizationId: user.organizationId,
        siteId: site.id,
        guardId: guard.id,
        alertType: GUARD_EMERGENCY_ALERT_TYPE,
        severity: 'HIGH',
        message,
        escalationStage: FIELD_ALERT_ESCALATION_INITIAL,
      },
    });

    await this.outbox.write({
      organizationId: user.organizationId,
      eventType: 'field.alert.created',
      aggregateType: 'FieldAlert',
      aggregateId: alert.id,
      payload: {
        siteId: site.id,
        guardId: guard.id,
        alertType: GUARD_EMERGENCY_ALERT_TYPE,
        severity: 'HIGH',
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'field_alert.guard_emergency',
      resourceType: 'FieldAlert',
      resourceId: alert.id,
      after: {
        alertType: alert.alertType,
        siteId: alert.siteId,
        guardId: alert.guardId,
        severity: alert.severity,
      },
    });

    return this.toDto(alert);
  }

  async escalate(
    id: string,
    user: AuthUser,
  ): Promise<FieldAlertResponseDto> {
    this.assertCanSuperviseFieldAlert(user);

    const alert = await this.prisma.fieldAlert.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!alert) throw new NotFoundException('Field alert not found');
    assertSiteAccess(user, alert.siteId);

    if (alert.acknowledged) {
      throw new BadRequestException('Cannot escalate acknowledged alert');
    }

    if (alert.escalationStage === 'CONTROL') {
      throw new BadRequestException(
        'Alert already at final escalation stage (CONTROL)',
      );
    }

    if (!canEscalateFieldAlertStage(alert.escalationStage, user.roles)) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: `Role cannot escalate from stage ${alert.escalationStage}`,
      });
    }

    const next = nextFieldAlertEscalationStage(alert.escalationStage);
    if (!next) {
      throw new BadRequestException('Cannot escalate further');
    }

    const updated = await this.prisma.fieldAlert.update({
      where: { id: alert.id },
      data: {
        escalationStage: next,
        escalatedAt: new Date(),
        escalatedBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'field_alert.escalated',
      resourceType: 'FieldAlert',
      resourceId: updated.id,
      before: { escalationStage: alert.escalationStage },
      after: {
        escalationStage: updated.escalationStage,
        escalatedAt: updated.escalatedAt,
        escalatedBy: updated.escalatedBy,
      },
    });

    return this.toDto(updated);
  }

  async acknowledge(
    id: string,
    user: AuthUser,
  ): Promise<FieldAlertResponseDto> {
    this.assertCanSuperviseFieldAlert(user);

    const alert = await this.prisma.fieldAlert.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!alert) throw new NotFoundException('Field alert not found');
    assertSiteAccess(user, alert.siteId);

    if (alert.acknowledged) {
      return this.toDto(alert);
    }

    const updated = await this.prisma.fieldAlert.update({
      where: { id: alert.id },
      data: {
        acknowledged: true,
        acknowledgedBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'field_alert.acknowledged',
      resourceType: 'FieldAlert',
      resourceId: updated.id,
      after: {
        acknowledged: updated.acknowledged,
        acknowledgedBy: updated.acknowledgedBy,
        escalationStage: updated.escalationStage,
      },
    });

    return this.toDto(updated);
  }

  private toDto(a: {
    id: string;
    organizationId: string;
    siteId: string;
    guardId: string | null;
    alertType: string;
    severity: string;
    message: string;
    acknowledged: boolean;
    acknowledgedBy: string | null;
    escalationStage: string;
    escalatedAt: Date | null;
    escalatedBy: string | null;
    createdAt: Date;
  }): FieldAlertResponseDto {
    return {
      id: a.id,
      organizationId: a.organizationId,
      siteId: a.siteId,
      guardId: a.guardId,
      alertType: a.alertType,
      severity: a.severity,
      message: a.message,
      acknowledged: a.acknowledged,
      acknowledgedBy: a.acknowledgedBy,
      escalationStage: a.escalationStage,
      escalatedAt: a.escalatedAt,
      escalatedBy: a.escalatedBy,
      createdAt: a.createdAt,
    };
  }
}
