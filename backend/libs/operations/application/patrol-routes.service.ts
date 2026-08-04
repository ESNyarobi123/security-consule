import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  AuthUser,
  assertSiteAccess,
  siteScopeWhere,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { OutboxWriterService } from '@pssms/notifications';
import {
  CreatePatrolRouteDto,
  PatrolRouteResponseDto,
  PatrolScanMissedResultDto,
} from '../presentation/dto/operations.dto';
import {
  PATROL_MISSED_ALERT_TYPE,
  PATROL_ROUTE_DUE_DEFAULT_MINUTES,
  dueAtForDay,
  localDayKey,
  patrolMissAlertToken,
  type PatrolSlaStatus,
} from '../domain/patrol-sla.constants';

@Injectable()
export class PatrolRoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxWriterService,
  ) {}

  async create(
    dto: CreatePatrolRouteDto,
    user: AuthUser,
  ): Promise<PatrolRouteResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
      select: { id: true, code: true, name: true },
    });
    if (!site) throw new BadRequestException('Site not found in organization');
    assertSiteAccess(user, dto.siteId);

    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Route name is required');

    const checkpointIds = [...new Set(dto.checkpointIds.map((id) => id.trim()))];
    if (checkpointIds.length === 0) {
      throw new BadRequestException('Select at least one checkpoint');
    }

    const cps = await this.prisma.checkpoint.findMany({
      where: {
        id: { in: checkpointIds },
        organizationId: user.organizationId,
        siteId: dto.siteId,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (cps.length !== checkpointIds.length) {
      throw new BadRequestException(
        'All checkpoints must belong to this site and be active',
      );
    }
    const byId = new Map(cps.map((c) => [c.id, c]));
    const ordered = checkpointIds.map((id) => byId.get(id)!);

    const dueMinutes =
      dto.dueMinutesFromMidnight !== undefined
        ? Math.min(1439, Math.max(0, Math.floor(dto.dueMinutesFromMidnight)))
        : PATROL_ROUTE_DUE_DEFAULT_MINUTES;

    const route = await this.prisma.patrolRoute.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        name,
        checkpointIds,
        dueMinutesFromMidnight: dueMinutes,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'patrol_route.created',
      resourceType: 'PatrolRoute',
      resourceId: route.id,
      after: {
        name: route.name,
        siteId: route.siteId,
        checkpointIds: route.checkpointIds,
        dueMinutesFromMidnight: route.dueMinutesFromMidnight,
      },
    });

    const dayStart = this.dayStart();
    const dueAt = dueAtForDay(dayStart, route.dueMinutesFromMidnight);
    return this.toDto(route, site, ordered, {
      scannedToday: 0,
      coverageStatus: 'NOT_STARTED',
      slaStatus: this.computeSla('NOT_STARTED', dueAt, false),
      dueAt,
      openPatrolAlertId: null,
    });
  }

  async list(
    organizationId: string,
    user: AuthUser,
    siteId?: string,
  ): Promise<PatrolRouteResponseDto[]> {
    if (siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: siteId, organizationId },
        select: { id: true },
      });
      if (!site) throw new BadRequestException('Site not found in organization');
      assertSiteAccess(user, siteId);
    }

    const rows = await this.prisma.patrolRoute.findMany({
      where: {
        organizationId,
        isActive: true,
        ...siteScopeWhere(user, siteId),
      },
      orderBy: [{ siteId: 'asc' }, { name: 'asc' }],
      take: 100,
    });

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = siteIds.length
      ? await this.prisma.site.findMany({
          where: { organizationId, id: { in: siteIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const siteMap = new Map(sites.map((s) => [s.id, s]));

    const allCpIds = [...new Set(rows.flatMap((r) => r.checkpointIds))];
    const cps = allCpIds.length
      ? await this.prisma.checkpoint.findMany({
          where: { organizationId, id: { in: allCpIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const cpMap = new Map(cps.map((c) => [c.id, c]));

    const dayStart = this.dayStart();
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayKey = localDayKey(dayStart);

    const scans =
      allCpIds.length === 0
        ? []
        : await this.prisma.patrolScan.findMany({
            where: {
              organizationId,
              checkpointId: { in: allCpIds },
              scannedAt: { gte: dayStart, lt: dayEnd },
              ...(siteId ? { siteId } : {}),
            },
            select: { siteId: true, checkpointId: true },
          });

    const scannedBySite = new Map<string, Set<string>>();
    for (const s of scans) {
      const set = scannedBySite.get(s.siteId) ?? new Set<string>();
      set.add(s.checkpointId);
      scannedBySite.set(s.siteId, set);
    }

    const openAlerts =
      rows.length === 0
        ? []
        : await this.prisma.fieldAlert.findMany({
            where: {
              organizationId,
              alertType: PATROL_MISSED_ALERT_TYPE,
              acknowledged: false,
              createdAt: { gte: dayStart, lt: dayEnd },
              ...(siteId ? { siteId } : {}),
            },
            select: { id: true, siteId: true, message: true },
          });

    const alertByRoute = new Map<string, string>();
    for (const a of openAlerts) {
      for (const r of rows) {
        if (
          r.siteId === a.siteId &&
          a.message.includes(patrolMissAlertToken(r.id, dayKey))
        ) {
          alertByRoute.set(r.id, a.id);
        }
      }
    }

    return rows.map((r) => {
      const ordered = r.checkpointIds
        .map((id) => cpMap.get(id))
        .filter((c): c is { id: string; code: string; name: string } => !!c);
      const scannedSet = scannedBySite.get(r.siteId) ?? new Set();
      const scannedToday = r.checkpointIds.filter((id) =>
        scannedSet.has(id),
      ).length;
      const total = r.checkpointIds.length;
      let coverageStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' =
        'NOT_STARTED';
      if (total > 0 && scannedToday >= total) coverageStatus = 'COMPLETED';
      else if (scannedToday > 0) coverageStatus = 'IN_PROGRESS';

      const dueAt = dueAtForDay(dayStart, r.dueMinutesFromMidnight);
      const openPatrolAlertId = alertByRoute.get(r.id) ?? null;
      const slaStatus = this.computeSla(
        coverageStatus,
        dueAt,
        !!openPatrolAlertId,
      );

      return this.toDto(r, siteMap.get(r.siteId), ordered, {
        scannedToday,
        coverageStatus,
        slaStatus,
        dueAt,
        openPatrolAlertId,
      });
    });
  }

  /**
   * Mark incomplete past-due route as MISSED + FieldAlert PATROL_MISSED (AL1).
   * Idempotent if open alert already exists for route+day.
   */
  async markMissed(
    routeId: string,
    user: AuthUser,
  ): Promise<PatrolRouteResponseDto & { newlyMarked: boolean }> {
    const route = await this.prisma.patrolRoute.findFirst({
      where: {
        id: routeId,
        organizationId: user.organizationId,
        isActive: true,
      },
    });
    if (!route) throw new NotFoundException('Patrol route not found');
    assertSiteAccess(user, route.siteId);

    const dayStart = this.dayStart();
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayKey = localDayKey(dayStart);
    const dueAt = dueAtForDay(dayStart, route.dueMinutesFromMidnight);
    const now = new Date();

    const coverage = await this.coverageForRoute(
      user.organizationId,
      route,
      dayStart,
      dayEnd,
    );
    if (coverage.coverageStatus === 'COMPLETED') {
      throw new BadRequestException('Route already completed today');
    }
    if (now < dueAt) {
      throw new BadRequestException(
        `Route not past due yet (due ${dueAt.toISOString()})`,
      );
    }

    const token = patrolMissAlertToken(route.id, dayKey);
    const existing = await this.prisma.fieldAlert.findFirst({
      where: {
        organizationId: user.organizationId,
        siteId: route.siteId,
        alertType: PATROL_MISSED_ALERT_TYPE,
        acknowledged: false,
        message: { contains: token },
        createdAt: { gte: dayStart, lt: dayEnd },
      },
    });

    let newlyMarked = false;
    if (!existing) {
      const alert = await this.prisma.fieldAlert.create({
        data: {
          organizationId: user.organizationId,
          siteId: route.siteId,
          alertType: PATROL_MISSED_ALERT_TYPE,
          severity: 'HIGH',
          message: `Patrol route missed: ${route.name} ${token}`,
          escalationStage: 'SUPERVISOR',
        },
      });
      newlyMarked = true;

      await this.outbox.write({
        organizationId: user.organizationId,
        eventType: 'field.alert.created',
        aggregateType: 'PatrolRoute',
        aggregateId: route.id,
        payload: {
          siteId: route.siteId,
          alertType: PATROL_MISSED_ALERT_TYPE,
          routeName: route.name,
          dayKey,
          fieldAlertId: alert.id,
        },
      });

      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'patrol.missed',
        resourceType: 'PatrolRoute',
        resourceId: route.id,
        after: {
          dayKey,
          fieldAlertId: alert.id,
          coverageStatus: coverage.coverageStatus,
        },
      });
    }

    const listed = await this.list(user.organizationId, user, route.siteId);
    const found = listed.find((r) => r.id === route.id);
    if (!found) throw new NotFoundException('Patrol route not found after miss');
    return { ...found, newlyMarked };
  }

  /**
   * Auto-miss ACTIVE routes past due (+ grace) that are not COMPLETED today.
   */
  async scanMissed(
    organizationId: string,
    actor: AuthUser,
    graceMinutes = 0,
  ): Promise<PatrolScanMissedResultDto> {
    const grace =
      Number.isFinite(graceMinutes) && graceMinutes > 0 ? graceMinutes : 0;
    const dayStart = this.dayStart();
    const now = new Date();
    const cutoff = new Date(now.getTime() - grace * 60_000);

    const routes = await this.prisma.patrolRoute.findMany({
      where: { organizationId, isActive: true },
      take: 200,
    });

    const markedRouteIds: string[] = [];
    const markedRouteNames: string[] = [];

    for (const route of routes) {
      const dueAt = dueAtForDay(dayStart, route.dueMinutesFromMidnight);
      if (cutoff < dueAt) continue;

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const coverage = await this.coverageForRoute(
        organizationId,
        route,
        dayStart,
        dayEnd,
      );
      if (coverage.coverageStatus === 'COMPLETED') continue;

      const result = await this.markMissed(route.id, actor);
      if (!result.newlyMarked) continue;
      markedRouteIds.push(route.id);
      markedRouteNames.push(route.name);
    }

    return {
      markedMissed: markedRouteIds.length,
      routeIds: markedRouteIds,
      routeNames: markedRouteNames,
    };
  }

  private async coverageForRoute(
    organizationId: string,
    route: { siteId: string; checkpointIds: string[] },
    dayStart: Date,
    dayEnd: Date,
  ): Promise<{
    scannedToday: number;
    coverageStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  }> {
    if (route.checkpointIds.length === 0) {
      return { scannedToday: 0, coverageStatus: 'NOT_STARTED' };
    }
    const scans = await this.prisma.patrolScan.findMany({
      where: {
        organizationId,
        siteId: route.siteId,
        checkpointId: { in: route.checkpointIds },
        scannedAt: { gte: dayStart, lt: dayEnd },
      },
      select: { checkpointId: true },
    });
    const scanned = new Set(scans.map((s) => s.checkpointId));
    const scannedToday = route.checkpointIds.filter((id) =>
      scanned.has(id),
    ).length;
    const total = route.checkpointIds.length;
    let coverageStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' =
      'NOT_STARTED';
    if (total > 0 && scannedToday >= total) coverageStatus = 'COMPLETED';
    else if (scannedToday > 0) coverageStatus = 'IN_PROGRESS';
    return { scannedToday, coverageStatus };
  }

  private computeSla(
    coverageStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
    dueAt: Date,
    hasOpenMissAlert: boolean,
  ): PatrolSlaStatus {
    if (coverageStatus === 'COMPLETED') return 'OK';
    if (hasOpenMissAlert) return 'MISSED';
    if (new Date() < dueAt) return 'ON_TRACK';
    return 'LATE';
  }

  private dayStart(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private toDto(
    route: {
      id: string;
      siteId: string;
      name: string;
      checkpointIds: string[];
      dueMinutesFromMidnight: number;
      isActive: boolean;
      createdAt: Date;
    },
    site: { code: string; name: string } | undefined,
    checkpoints: { id: string; code: string; name: string }[],
    coverage: {
      scannedToday: number;
      coverageStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
      slaStatus: PatrolSlaStatus;
      dueAt: Date;
      openPatrolAlertId: string | null;
    },
  ): PatrolRouteResponseDto {
    return {
      id: route.id,
      siteId: route.siteId,
      siteCode: site?.code,
      siteName: site?.name,
      name: route.name,
      checkpointIds: route.checkpointIds,
      checkpoints,
      checkpointCount: route.checkpointIds.length,
      scannedToday: coverage.scannedToday,
      coverageStatus: coverage.coverageStatus,
      slaStatus: coverage.slaStatus,
      dueMinutesFromMidnight: route.dueMinutesFromMidnight,
      dueAt: coverage.dueAt,
      openPatrolAlertId: coverage.openPatrolAlertId,
      isActive: route.isActive,
      createdAt: route.createdAt,
    };
  }
}
