import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { FieldAlertResponseDto } from '../presentation/dto/attendance.dto';
import {
  nextFieldAlertEscalationStage,
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
  ) {}

  /**
   * Seeded GUARD also has operations.manage / attendance.manage for mobile.
   * Escalate + acknowledge stay staff-only (same pattern as attendance supervise).
   */
  private assertCanSuperviseFieldAlert(user: AuthUser): void {
    if (
      user.roles.includes('GUARD') &&
      !user.roles.some((r) => FIELD_ALERT_SUPERVISE_ROLES.has(r))
    ) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Guards cannot escalate or acknowledge field alerts',
      });
    }
  }

  async list(
    organizationId: string,
    siteId?: string,
    acknowledged?: boolean,
    escalationStage?: FieldAlertEscalationStage,
  ): Promise<FieldAlertResponseDto[]> {
    const rows = await this.prisma.fieldAlert.findMany({
      where: {
        organizationId,
        ...(siteId ? { siteId } : {}),
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

  async escalate(
    id: string,
    user: AuthUser,
  ): Promise<FieldAlertResponseDto> {
    this.assertCanSuperviseFieldAlert(user);

    const alert = await this.prisma.fieldAlert.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!alert) throw new NotFoundException('Field alert not found');

    if (alert.acknowledged) {
      throw new BadRequestException('Cannot escalate acknowledged alert');
    }

    if (alert.escalationStage === 'CONTROL') {
      throw new BadRequestException(
        'Alert already at final escalation stage (CONTROL)',
      );
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
