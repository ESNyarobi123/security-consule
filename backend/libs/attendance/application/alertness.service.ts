import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertnessStatus, GuardStatus } from '@prisma/client';
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

/** Module 8-G — no new alertness duty while absent / suspended / terminated. */
const ALERTNESS_BLOCKED_STATUSES: GuardStatus[] = [
  GuardStatus.TERMINATED,
  GuardStatus.SUSPENDED,
  GuardStatus.ABSENT,
];
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
      select: { id: true, status: true },
    });
    if (!guard) throw new NotFoundException('Guard not found');
    if (ALERTNESS_BLOCKED_STATUSES.includes(guard.status)) {
      throw new BadRequestException({
        error: 'GUARD_STATUS_BLOCKS_ALERTNESS',
        message: `Guard status ${guard.status} cannot schedule alertness`,
        status: guard.status,
      });
    }

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

    // Module 8-G — defense in depth if a punch path ever bypasses status guard.
    const guardRow = await this.prisma.guardProfile.findFirst({
      where: { id: input.guardId, organizationId: input.organizationId },
      select: { status: true },
    });
    if (
      !guardRow ||
      ALERTNESS_BLOCKED_STATUSES.includes(guardRow.status)
    ) {
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
      if (
        dup?.status === AlertnessStatus.CONFIRMED ||
        dup?.status === AlertnessStatus.LATE
      ) {
        return dup;
      }
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
    if (
      check.status === AlertnessStatus.CONFIRMED ||
      check.status === AlertnessStatus.LATE
    ) {
      return check;
    }
    if (check.status === AlertnessStatus.MISSED) {
      throw new BadRequestException('Alertness check already marked missed');
    }
    if (check.status === AlertnessStatus.CANCELLED) {
      throw new BadRequestException('Alertness check was cancelled (guard ABSENT)');
    }
    if (check.status !== AlertnessStatus.SCHEDULED) {
      throw new BadRequestException(
        `Only SCHEDULED checks can be confirmed (now ${check.status})`,
      );
    }

    const serverNow = new Date();
    // Module 10-A — confirm after due (+ optional grace) records LATE, not CONFIRMED.
    const graceMin = Number(process.env.ALERTNESS_LATE_GRACE_MINUTES ?? '0');
    const graceMs =
      (Number.isFinite(graceMin) && graceMin > 0 ? graceMin : 0) * 60_000;
    const lateAfter = new Date(check.scheduledAt.getTime() + graceMs);
    const status =
      serverNow.getTime() > lateAfter.getTime()
        ? AlertnessStatus.LATE
        : AlertnessStatus.CONFIRMED;

    const updated = await this.prisma.alertnessCheck.update({
      where: { id: check.id },
      data: {
        status,
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
      after: {
        ...updated,
        late: status === AlertnessStatus.LATE,
        lateGraceMinutes: graceMs / 60_000,
      },
    });

    return updated;
  }

  /**
   * Module 8-F — cancel outstanding SCHEDULED checks when ops marks guard ABSENT
   * so scan-missed / mark-missed will not raise FieldAlert for an absent guard.
   */
  async cancelScheduledForGuardAbsent(
    guardId: string,
    user: AuthUser,
    meta?: { reason?: string },
  ): Promise<{ cancelledIds: string[] }> {
    const open = await this.prisma.alertnessCheck.findMany({
      where: {
        organizationId: user.organizationId,
        guardId,
        status: AlertnessStatus.SCHEDULED,
      },
    });
    if (open.length === 0) return { cancelledIds: [] };

    const cancelledIds: string[] = [];
    const reason = meta?.reason?.trim();
    for (const row of open) {
      const updated = await this.prisma.alertnessCheck.update({
        where: { id: row.id },
        data: { status: AlertnessStatus.CANCELLED },
      });
      cancelledIds.push(updated.id);
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'alertness.cancelled_for_absent',
        resourceType: 'AlertnessCheck',
        resourceId: updated.id,
        before: row,
        after: {
          ...updated,
          trigger: 'guard.status.ABSENT',
          ...(reason ? { reason } : {}),
        },
      });
    }
    return { cancelledIds };
  }

  /**
   * Mark SCHEDULED check as MISSED and raise HIGH FieldAlert for
   * Supervisor / Field / BOM / Control Room queues (ack on field-alerts).
   * Idempotent if already MISSED.
   */
  async markMissed(
    checkId: string,
    user: AuthUser,
    supervisorRemarks?: string,
  ) {
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

    const remarks = supervisorRemarks?.trim() || undefined;
    const updated = await this.prisma.alertnessCheck.update({
      where: { id: checkId },
      data: {
        status: AlertnessStatus.MISSED,
        ...(remarks ? { supervisorRemarks: remarks } : {}),
      },
    });

    const alertMessage = remarks
      ? `Guard missed alertness check ${check.referenceNumber}: ${remarks}`
      : `Guard missed alertness check ${check.referenceNumber}`;

    await this.prisma.fieldAlert.create({
      data: {
        organizationId: user.organizationId,
        siteId: check.siteId,
        guardId: check.guardId,
        alertType: 'ALERTNESS_MISSED',
        severity: 'HIGH',
        message: alertMessage,
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
        ...(remarks ? { supervisorRemarks: remarks } : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'alertness.missed',
      resourceType: 'AlertnessCheck',
      resourceId: checkId,
      before: { status: check.status },
      after: {
        status: updated.status,
        ...(remarks ? { supervisorRemarks: remarks } : {}),
      },
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

    const rows = await this.prisma.alertnessCheck.findMany({
      where: {
        organizationId: user.organizationId,
        status: AlertnessStatus.SCHEDULED,
        ...(resolvedGuardId ? { guardId: resolvedGuardId } : {}),
        ...(manage ? siteScopeWhere(user) : {}),
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });
    const now = Date.now();
    // Module 10-A — pastDue hints that confirm will record LATE (until mark-missed).
    return rows.map((r) => ({
      ...r,
      pastDue: r.scheduledAt.getTime() < now,
    }));
  }

  /**
   * Module 10-C — completed alertness roster for audit (CONFIRMED/LATE/MISSED/CANCELLED).
   * Staff: site-scoped. Guard self: own records only.
   */
  async listHistory(
    user: AuthUser,
    opts: {
      guardId?: string;
      siteId?: string;
      status?: string;
      from?: string;
      to?: string;
      take?: number;
    } = {},
  ) {
    const manage = canManageAlertness(user);
    let resolvedGuardId = opts.guardId;

    if (!manage) {
      const self = await this.guards.getByUserId(
        user.id,
        user.organizationId,
      );
      if (!self) {
        throw new ForbiddenException(
          'Missing permission(s): operations.manage or attendance.manage',
        );
      }
      if (opts.guardId && opts.guardId !== self.id) {
        throw new ForbiddenException(
          'Cannot list alertness history for another guard',
        );
      }
      resolvedGuardId = self.id;
    } else if (opts.guardId) {
      const target = await this.prisma.guardProfile.findFirst({
        where: { id: opts.guardId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('Guard not found');
      resolvedGuardId = target.id;
    }

    if (opts.siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: opts.siteId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!site) throw new NotFoundException('Site not found');
      if (manage) assertSiteAccess(user, opts.siteId);
    }

    const defaultStatuses: AlertnessStatus[] = [
      AlertnessStatus.CONFIRMED,
      AlertnessStatus.LATE,
      AlertnessStatus.MISSED,
      AlertnessStatus.CANCELLED,
    ];
    let statuses = defaultStatuses;
    if (opts.status?.trim()) {
      const parts = opts.status
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const parsed = parts.filter((p): p is AlertnessStatus =>
        (Object.values(AlertnessStatus) as string[]).includes(p),
      );
      if (parsed.length === 0) {
        throw new BadRequestException({
          error: 'INVALID_ALERTNESS_STATUS',
          message: `status must be one of ${Object.values(AlertnessStatus).join(',')}`,
        });
      }
      statuses = parsed;
    }

    const takeRaw = opts.take ?? 40;
    const take = Math.min(Math.max(Number.isFinite(takeRaw) ? takeRaw : 40, 1), 100);

    const from = opts.from ? new Date(opts.from) : undefined;
    const to = opts.to ? new Date(opts.to) : undefined;
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException({ error: 'INVALID_FROM', message: 'Invalid from' });
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException({ error: 'INVALID_TO', message: 'Invalid to' });
    }

    const rows = await this.prisma.alertnessCheck.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: statuses },
        ...(resolvedGuardId ? { guardId: resolvedGuardId } : {}),
        ...(opts.siteId ? { siteId: opts.siteId } : {}),
        ...(from || to
          ? {
              scheduledAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lt: to } : {}),
              },
            }
          : {}),
        ...(manage ? siteScopeWhere(user) : {}),
      },
      orderBy: { scheduledAt: 'desc' },
      take,
    });

    const guardIds = [...new Set(rows.map((r) => r.guardId))];
    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const [guards, sites] = await Promise.all([
      guardIds.length
        ? this.prisma.guardProfile.findMany({
            where: {
              organizationId: user.organizationId,
              id: { in: guardIds },
            },
            select: { id: true, employeeNumber: true },
          })
        : Promise.resolve([]),
      siteIds.length
        ? this.prisma.site.findMany({
            where: {
              organizationId: user.organizationId,
              id: { in: siteIds },
            },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const guardById = new Map(guards.map((g) => [g.id, g]));
    const siteById = new Map(sites.map((s) => [s.id, s]));

    return rows.map((r) => {
      const g = guardById.get(r.guardId);
      const s = siteById.get(r.siteId);
      return {
        ...r,
        employeeNumber: g?.employeeNumber ?? null,
        siteCode: s?.code ?? null,
        siteName: s?.name ?? null,
      };
    });
  }
}
