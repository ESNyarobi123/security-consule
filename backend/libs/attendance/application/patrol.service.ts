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
  isGuardSelfScoped,
  siteScopeWhere,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { GuardsService } from '@pssms/workforce';
import { PatrolScanDto } from '../presentation/dto/attendance.dto';

@Injectable()
export class PatrolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly guards: GuardsService,
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

    const checkpoint = await this.prisma.checkpoint.findFirst({
      where: {
        id: dto.checkpointId,
        siteId: dto.siteId,
        organizationId: user.organizationId,
        isActive: true,
      },
    });
    if (!checkpoint) throw new NotFoundException('Checkpoint not found');

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
