import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertnessStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  PrismaService,
  AuthUser,
  assertNotGuardSelfScoped,
  assertSiteAccess,
  isGuardSelfScoped,
  siteScopeWhere,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { GuardsService } from '@pssms/workforce';
import { OutboxWriterService } from '@pssms/notifications';
import {
  ConfirmAlertnessDto,
  ScheduleAlertnessDto,
} from '../presentation/dto/attendance.dto';
import { FIELD_ALERT_ESCALATION_INITIAL } from '../domain/field-alert.constants';

function canManageAlertness(user: AuthUser): boolean {
  if (isGuardSelfScoped(user)) return false;
  if (user.roles.includes('SUPER_ADMIN')) return true;
  return (
    user.permissions.includes('operations.manage') ||
    user.permissions.includes('attendance.manage')
  );
}

export type AlertnessScanMissedResult = {
  markedMissed: number;
  referenceNumbers: string[];
};

@Injectable()
export class AlertnessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly guards: GuardsService,
    private readonly outbox: OutboxWriterService,
  ) {}

  async schedule(dto: ScheduleAlertnessDto, user: AuthUser) {
    assertNotGuardSelfScoped(user, 'schedule alertness for others');
    const guard = await this.prisma.guardProfile.findFirst({
      where: { id: dto.guardId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!guard) throw new NotFoundException('Guard not found');

    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!site) throw new NotFoundException('Site not found');
    assertSiteAccess(user, dto.siteId);

    if (dto.shiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: {
          id: dto.shiftId,
          organizationId: user.organizationId,
          siteId: dto.siteId,
        },
        select: { id: true },
      });
      if (!shift) throw new BadRequestException('Shift not found for this site');
    }

    return this.createCheck({
      organizationId: user.organizationId,
      actorId: user.id,
      guardId: dto.guardId,
      siteId: dto.siteId,
      shiftId: dto.shiftId,
      scheduledAt: new Date(dto.scheduledAt),
      source: 'manual',
    });
  }

  /**
   * After clock-in: create duty alertness checks at interval (default 2h),
   * optionally randomized within a jitter window. Skips if upcoming SCHEDULED
   * checks already exist for this guard+site (+shift). Disable with
   * ALERTNESS_AUTO_SCHEDULE_ON_CLOCK_IN=false.
   */
  async scheduleForDuty(input: {
    organizationId: string;
    actorId: string;
    guardId: string;
    siteId: string;
    shiftId?: string | null;
    clockInAt: Date;
  }): Promise<{ scheduled: number; referenceNumbers: string[]; skipped: boolean }> {
    if (process.env.ALERTNESS_AUTO_SCHEDULE_ON_CLOCK_IN === 'false') {
      return { scheduled: 0, referenceNumbers: [], skipped: true };
    }

    const intervalMin = Number(
      process.env.ALERTNESS_INTERVAL_MINUTES ?? '120',
    );
    const intervalMs =
      (Number.isFinite(intervalMin) && intervalMin > 0 ? intervalMin : 120) *
      60_000;
    const randomize = process.env.ALERTNESS_RANDOMIZE !== 'false';
    const jitterMin = Number(
      process.env.ALERTNESS_RANDOM_JITTER_MINUTES ?? '30',
    );
    const jitterMs =
      (Number.isFinite(jitterMin) && jitterMin >= 0 ? jitterMin : 30) * 60_000;
    const defaultDutyHours = Number(
      process.env.ALERTNESS_DEFAULT_DUTY_HOURS ?? '8',
    );
    const dutyMs =
      (Number.isFinite(defaultDutyHours) && defaultDutyHours > 0
        ? defaultDutyHours
        : 8) *
      60 *
      60_000;
    const maxChecks = Math.min(
      Number(process.env.ALERTNESS_MAX_CHECKS_PER_DUTY ?? '6') || 6,
      12,
    );

    let windowEnd = new Date(input.clockInAt.getTime() + dutyMs);
    if (input.shiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: {
          id: input.shiftId,
          organizationId: input.organizationId,
          siteId: input.siteId,
        },
        select: { endAt: true },
      });
      if (shift?.endAt && shift.endAt > input.clockInAt) {
        windowEnd = shift.endAt;
      }
    }

    const upcoming = await this.prisma.alertnessCheck.count({
      where: {
        organizationId: input.organizationId,
        guardId: input.guardId,
        siteId: input.siteId,
        status: AlertnessStatus.SCHEDULED,
        scheduledAt: { gt: input.clockInAt },
        ...(input.shiftId ? { shiftId: input.shiftId } : {}),
      },
    });
    if (upcoming > 0) {
      return { scheduled: 0, referenceNumbers: [], skipped: true };
    }

    const referenceNumbers: string[] = [];
    let slot = input.clockInAt.getTime() + intervalMs;
    let created = 0;
    while (slot < windowEnd.getTime() && created < maxChecks) {
      let scheduledAt = new Date(slot);
      if (randomize && jitterMs > 0) {
        const delta = Math.floor(Math.random() * (jitterMs * 2 + 1)) - jitterMs;
        scheduledAt = new Date(slot + delta);
        if (scheduledAt <= input.clockInAt) {
          scheduledAt = new Date(input.clockInAt.getTime() + 60_000);
        }
        if (scheduledAt >= windowEnd) {
          scheduledAt = new Date(windowEnd.getTime() - 60_000);
        }
      }
      if (scheduledAt > input.clockInAt && scheduledAt < windowEnd) {
        const check = await this.createCheck({
          organizationId: input.organizationId,
          actorId: input.actorId,
          guardId: input.guardId,
          siteId: input.siteId,
          shiftId: input.shiftId ?? undefined,
          scheduledAt,
          source: 'auto_clock_in',
        });
        referenceNumbers.push(check.referenceNumber);
        created += 1;
      }
      slot += intervalMs;
    }

    if (created > 0) {
      await this.audit.record({
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: 'alertness.auto_scheduled',
        resourceType: 'GuardAttendance',
        resourceId: `${input.guardId}:${input.siteId}`,
        after: {
          guardId: input.guardId,
          siteId: input.siteId,
          shiftId: input.shiftId ?? null,
          scheduled: created,
          intervalMinutes: intervalMs / 60_000,
          randomize,
          referenceNumbers,
        },
      });
    }

    return { scheduled: created, referenceNumbers, skipped: false };
  }

  private async createCheck(input: {
    organizationId: string;
    actorId: string;
    guardId: string;
    siteId: string;
    shiftId?: string;
    scheduledAt: Date;
    source: 'manual' | 'auto_clock_in';
  }) {
    const ref = `ALT-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const check = await this.prisma.alertnessCheck.create({
      data: {
        organizationId: input.organizationId,
        guardId: input.guardId,
        siteId: input.siteId,
        shiftId: input.shiftId,
        scheduledAt: input.scheduledAt,
        referenceNumber: ref,
      },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: 'alertness.scheduled',
      resourceType: 'AlertnessCheck',
      resourceId: check.id,
      after: {
        referenceNumber: check.referenceNumber,
        guardId: check.guardId,
        siteId: check.siteId,
        scheduledAt: check.scheduledAt,
        source: input.source,
      },
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
    if (check.status === AlertnessStatus.MISSED) {
      throw new BadRequestException('Alertness check already marked missed');
    }

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

  /**
   * Mark SCHEDULED check as MISSED and raise HIGH FieldAlert for
   * Supervisor / Field / BOM / Control Room queues (ack on field-alerts).
   * Idempotent if already MISSED.
   */
  async markMissed(checkId: string, user: AuthUser) {
    assertNotGuardSelfScoped(user, 'mark alertness missed');
    const check = await this.prisma.alertnessCheck.findFirst({
      where: { id: checkId, organizationId: user.organizationId },
    });
    if (!check) throw new NotFoundException('Alertness check not found');
    assertSiteAccess(user, check.siteId);

    if (check.status === AlertnessStatus.MISSED) {
      return check;
    }
    if (check.status !== AlertnessStatus.SCHEDULED) {
      throw new BadRequestException(
        `Only SCHEDULED checks can be marked missed (now ${check.status})`,
      );
    }

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
        escalationStage: FIELD_ALERT_ESCALATION_INITIAL,
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
        referenceNumber: check.referenceNumber,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'alertness.missed',
      resourceType: 'AlertnessCheck',
      resourceId: checkId,
      before: { status: check.status },
      after: { status: updated.status },
    });

    return updated;
  }

  /**
   * Auto-miss SCHEDULED checks whose scheduledAt is older than now − graceMinutes.
   * Feeds the same FieldAlert path as manual markMissed.
   */
  async scanMissed(
    organizationId: string,
    actor: AuthUser,
    graceMinutes = 0,
  ): Promise<AlertnessScanMissedResult> {
    assertNotGuardSelfScoped(actor, 'scan missed alertness');
    const grace = Number.isFinite(graceMinutes) && graceMinutes > 0
      ? graceMinutes
      : 0;
    const cutoff = new Date(Date.now() - grace * 60_000);

    const due = await this.prisma.alertnessCheck.findMany({
      where: {
        organizationId,
        status: AlertnessStatus.SCHEDULED,
        scheduledAt: { lt: cutoff },
        ...siteScopeWhere(actor),
      },
      select: { id: true, referenceNumber: true },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    });

    const referenceNumbers: string[] = [];
    for (const row of due) {
      await this.markMissed(row.id, actor);
      if (row.referenceNumber) referenceNumbers.push(row.referenceNumber);
    }

    return { markedMissed: due.length, referenceNumbers };
  }

  async listPending(user: AuthUser, guardId?: string) {
    const manage = canManageAlertness(user);
    let resolvedGuardId = guardId;

    if (!manage) {
      // Guard self-service only — never org-wide or another guard's queue
      const self = await this.guards.getByUserId(
        user.id,
        user.organizationId,
      );
      if (!self) {
        throw new ForbiddenException(
          'Missing permission(s): operations.manage or attendance.manage',
        );
      }
      if (guardId && guardId !== self.id) {
        throw new ForbiddenException(
          'Cannot list pending alertness for another guard',
        );
      }
      resolvedGuardId = self.id;
    } else if (guardId) {
      const target = await this.prisma.guardProfile.findFirst({
        where: { id: guardId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('Guard not found');
      resolvedGuardId = target.id;
    }

    return this.prisma.alertnessCheck.findMany({
      where: {
        organizationId: user.organizationId,
        status: AlertnessStatus.SCHEDULED,
        ...(resolvedGuardId ? { guardId: resolvedGuardId } : {}),
        ...(manage ? siteScopeWhere(user) : {}),
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });
  }
}
