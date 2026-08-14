import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceMethod } from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  assertSiteAccess,
  isGuardSelfScoped,
  siteScopeWhere,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { IncidentsService } from '@pssms/incidents';
import { GuardsService } from '@pssms/workforce';
import {
  PatrolIssueDto,
  PatrolScanDto,
} from '../presentation/dto/attendance.dto';

@Injectable()
export class PatrolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly guards: GuardsService,
    private readonly incidents: IncidentsService,
  ) {}

  async scan(dto: PatrolScanDto, user: AuthUser) {
    if (dto.clientEventId) {
      const dup = await this.prisma.patrolScan.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (dup) return dup;
    }

    const guard = await this.guards.getByUserId(user.id, user.organizationId);
    if (!guard) throw new BadRequestException('User is not a registered guard');
    assertSiteAccess(user, dto.siteId);

    const checkpoint = await this.prisma.checkpoint.findFirst({
      where: {
        id: dto.checkpointId,
        siteId: dto.siteId,
        organizationId: user.organizationId,
        isActive: true,
      },
    });
    if (!checkpoint) throw new NotFoundException('Checkpoint not found');

    if (dto.routeId) {
      const route = await this.prisma.patrolRoute.findFirst({
        where: {
          id: dto.routeId,
          organizationId: user.organizationId,
          siteId: dto.siteId,
          isActive: true,
        },
        select: { checkpointIds: true },
      });
      if (!route) throw new NotFoundException('Patrol route not found');
      if (!route.checkpointIds.includes(dto.checkpointId)) {
        throw new BadRequestException(
          'Checkpoint does not belong to the selected patrol route',
        );
      }
    }

    if (dto.qrOrNfcCode) {
      const match =
        checkpoint.qrCode === dto.qrOrNfcCode ||
        checkpoint.nfcTagId === dto.qrOrNfcCode ||
        checkpoint.code === dto.qrOrNfcCode;
      if (!match) {
        throw new BadRequestException('Invalid checkpoint code');
      }
    }

    const serverNow = new Date();
    const scan = await this.prisma.patrolScan.create({
      data: {
        organizationId: user.organizationId,
        guardId: guard.id,
        siteId: dto.siteId,
        checkpointId: dto.checkpointId,
        routeId: dto.routeId,
        scannedAt: serverNow,
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
      action: 'patrol.scan',
      resourceType: 'PatrolScan',
      resourceId: scan.id,
      after: scan,
    });

    return scan;
  }

  /**
   * Guard-safe active route catalog. It intentionally excludes QR/NFC token
   * values; the physical token is submitted only when scanning.
   */
  async listGuardRoutes(user: AuthUser, siteId?: string) {
    if (siteId) assertSiteAccess(user, siteId);
    const routes = await this.prisma.patrolRoute.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...siteScopeWhere(user, siteId),
      },
      orderBy: [{ siteId: 'asc' }, { name: 'asc' }],
      take: 100,
    });
    const checkpointIds = [...new Set(routes.flatMap((r) => r.checkpointIds))];
    const checkpoints = checkpointIds.length
      ? await this.prisma.checkpoint.findMany({
          where: {
            organizationId: user.organizationId,
            id: { in: checkpointIds },
            isActive: true,
          },
          select: {
            id: true,
            siteId: true,
            code: true,
            name: true,
            zone: true,
            latitude: true,
            longitude: true,
          },
        })
      : [];
    const checkpointMap = new Map(checkpoints.map((cp) => [cp.id, cp]));
    return routes.map((route) => ({
      id: route.id,
      siteId: route.siteId,
      name: route.name,
      dueMinutesFromMidnight: route.dueMinutesFromMidnight,
      checkpoints: route.checkpointIds
        .map((id) => checkpointMap.get(id))
        .filter((cp): cp is NonNullable<typeof cp> => Boolean(cp)),
    }));
  }

  /** Module 20-A — create an auditable patrol incident via the incidents port. */
  async reportIssue(dto: PatrolIssueDto, user: AuthUser) {
    const guard = await this.guards.getByUserId(user.id, user.organizationId);
    if (!guard) throw new BadRequestException('User is not a registered guard');
    assertSiteAccess(user, dto.siteId);

    const route = await this.prisma.patrolRoute.findFirst({
      where: {
        id: dto.routeId,
        organizationId: user.organizationId,
        siteId: dto.siteId,
        isActive: true,
      },
      select: { id: true, name: true, checkpointIds: true },
    });
    if (!route) throw new NotFoundException('Patrol route not found');

    let checkpoint:
      | { id: string; code: string; name: string }
      | undefined;
    if (dto.checkpointId) {
      if (!route.checkpointIds.includes(dto.checkpointId)) {
        throw new BadRequestException(
          'Checkpoint does not belong to the selected patrol route',
        );
      }
      checkpoint = await this.prisma.checkpoint.findFirst({
        where: {
          id: dto.checkpointId,
          organizationId: user.organizationId,
          siteId: dto.siteId,
          isActive: true,
        },
        select: { id: true, code: true, name: true },
      }) ?? undefined;
      if (!checkpoint) throw new NotFoundException('Checkpoint not found');
    }

    const context = checkpoint
      ? `Route ${route.name}; checkpoint ${checkpoint.code} — ${checkpoint.name}.`
      : `Route ${route.name}.`;
    const incident = await this.incidents.create(
      {
        siteId: dto.siteId,
        category: 'PATROL_ISSUE',
        title: dto.title,
        description: `${context}\n${dto.description}`,
        severity: dto.severity,
        latitude: dto.gps.latitude,
        longitude: dto.gps.longitude,
        deviceReportedAt: dto.deviceTime,
        clientEventId: dto.clientEventId,
      },
      user,
    );

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'patrol.issue.reported',
      resourceType: 'Incident',
      resourceId: incident.id,
      after: {
        incidentNumber: incident.incidentNumber,
        guardId: guard.id,
        routeId: route.id,
        checkpointId: checkpoint?.id ?? null,
      },
    });
    return incident;
  }

  async list(organizationId: string, user: AuthUser, siteId?: string) {
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

    const scans = await this.prisma.patrolScan.findMany({
      where: {
        organizationId,
        ...(selfGuardId
          ? { guardId: selfGuardId }
          : siteScopeWhere(user, siteId)),
      },
      orderBy: { scannedAt: 'desc' },
      take: 100,
      include: {
        checkpoint: { select: { code: true, name: true, zone: true } },
      },
    });

    const siteIds = [...new Set(scans.map((s) => s.siteId))];
    const sites = siteIds.length
      ? await this.prisma.site.findMany({
          where: { organizationId, id: { in: siteIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const siteMap = new Map(sites.map((s) => [s.id, s]));

    return scans.map((s) => {
      const site = siteMap.get(s.siteId);
      return {
        id: s.id,
        organizationId: s.organizationId,
        guardId: s.guardId,
        siteId: s.siteId,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        checkpointId: s.checkpointId,
        checkpointCode: s.checkpoint.code,
        checkpointName: s.checkpoint.name,
        checkpointZone: s.checkpoint.zone,
        routeId: s.routeId,
        scannedAt: s.scannedAt,
        method: s.method,
        latitude: s.latitude,
        longitude: s.longitude,
        deviceTime: s.deviceTime,
        serverReceivedAt: s.serverReceivedAt,
        syncStatus: s.syncStatus,
        remarks: s.remarks,
        createdAt: s.createdAt,
        checkpoint: s.checkpoint,
      };
    });
  }
}
