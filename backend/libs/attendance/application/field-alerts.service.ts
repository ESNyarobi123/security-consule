import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { FieldAlertResponseDto } from '../presentation/dto/attendance.dto';

const SEVERITY_RANK: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

@Injectable()
export class FieldAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    organizationId: string,
    siteId?: string,
    acknowledged?: boolean,
  ): Promise<FieldAlertResponseDto[]> {
    const rows = await this.prisma.fieldAlert.findMany({
      where: {
        organizationId,
        ...(siteId ? { siteId } : {}),
        ...(typeof acknowledged === 'boolean' ? { acknowledged } : {}),
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

  async acknowledge(
    id: string,
    user: AuthUser,
  ): Promise<FieldAlertResponseDto> {
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
      after: updated,
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
      createdAt: a.createdAt,
    };
  }
}
