import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertnessStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { GuardsService } from '@pssms/workforce';
import { OutboxWriterService } from '@pssms/notifications';
import {
  ConfirmAlertnessDto,
  ScheduleAlertnessDto,
} from '../presentation/dto/attendance.dto';

@Injectable()
export class AlertnessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly guards: GuardsService,
    private readonly outbox: OutboxWriterService,
  ) {}

  async schedule(dto: ScheduleAlertnessDto, user: AuthUser) {
    const ref = `ALT-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const check = await this.prisma.alertnessCheck.create({
      data: {
        organizationId: user.organizationId,
        guardId: dto.guardId,
        siteId: dto.siteId,
        shiftId: dto.shiftId,
        scheduledAt: new Date(dto.scheduledAt),
        referenceNumber: ref,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'alertness.scheduled',
      resourceType: 'AlertnessCheck',
      resourceId: check.id,
      after: check,
    });

    return check;
  }

  async confirm(dto: ConfirmAlertnessDto, user: AuthUser) {
    if (dto.clientEventId) {
      const dup = await this.prisma.alertnessCheck.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (dup?.status === AlertnessStatus.CONFIRMED) return dup;
    }

    const guard = await this.guards.getByUserId(user.id, user.organizationId);
    if (!guard) throw new BadRequestException('User is not a registered guard');

    const check = await this.prisma.alertnessCheck.findFirst({
      where: {
        id: dto.alertnessCheckId,
        organizationId: user.organizationId,
        guardId: guard.id,
      },
    });
    if (!check) throw new NotFoundException('Alertness check not found');
    if (check.status === AlertnessStatus.CONFIRMED) return check;

    const serverNow = new Date();
    const updated = await this.prisma.alertnessCheck.update({
      where: { id: check.id },
      data: {
        status: AlertnessStatus.CONFIRMED,
        confirmedAt: serverNow,
        method: dto.method,
        latitude: dto.gps.latitude,
        longitude: dto.gps.longitude,
        deviceTime: dto.deviceTime ? new Date(dto.deviceTime) : serverNow,
        serverReceivedAt: serverNow,
        clientEventId: dto.clientEventId,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'alertness.confirmed',
      resourceType: 'AlertnessCheck',
      resourceId: updated.id,
      after: updated,
    });

    return updated;
  }

  async markMissed(checkId: string, user: AuthUser) {
    const check = await this.prisma.alertnessCheck.findFirst({
      where: { id: checkId, organizationId: user.organizationId },
    });
    if (!check) throw new NotFoundException('Alertness check not found');

    const updated = await this.prisma.alertnessCheck.update({
      where: { id: checkId },
      data: { status: AlertnessStatus.MISSED },
    });

    await this.prisma.fieldAlert.create({
      data: {
        organizationId: user.organizationId,
        siteId: check.siteId,
        guardId: check.guardId,
        alertType: 'ALERTNESS_MISSED',
        severity: 'HIGH',
        message: `Guard missed alertness check ${check.referenceNumber}`,
      },
    });

    await this.outbox.write({
      organizationId: user.organizationId,
      eventType: 'field.alert.created',
      aggregateType: 'AlertnessCheck',
      aggregateId: checkId,
      payload: {
        siteId: check.siteId,
        guardId: check.guardId,
        alertType: 'ALERTNESS_MISSED',
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'alertness.missed',
      resourceType: 'AlertnessCheck',
      resourceId: checkId,
      after: updated,
    });

    return updated;
  }

  async listPending(user: AuthUser, guardId?: string) {
    let resolvedGuardId = guardId;
    if (!resolvedGuardId) {
      const guard = await this.guards.getByUserId(
        user.id,
        user.organizationId,
      );
      if (guard) resolvedGuardId = guard.id;
    }

    return this.prisma.alertnessCheck.findMany({
      where: {
        organizationId: user.organizationId,
        status: AlertnessStatus.SCHEDULED,
        ...(resolvedGuardId ? { guardId: resolvedGuardId } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });
  }
}
