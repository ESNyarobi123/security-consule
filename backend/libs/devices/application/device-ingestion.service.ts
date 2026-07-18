import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, DeviceEventType } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { ParkingService } from '@pssms/parking';
import { DeviceAuthContext } from '../infrastructure/device-auth.guard';
import { HeartbeatDto, IngestEventDto } from '../presentation/dto/device.dto';

/**
 * Ingests normalized device events (append-only), deduplicates, and routes
 * recognized event types into their owning domain. Every device writes to the
 * same auditable log regardless of vendor/protocol.
 */
@Injectable()
export class DeviceIngestionService {
  private readonly logger = new Logger(DeviceIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parking: ParkingService,
  ) {}

  async heartbeat(ctx: DeviceAuthContext, dto: HeartbeatDto) {
    const now = new Date();
    if (ctx.kind === 'gateway' && ctx.gateway) {
      await this.prisma.edgeGateway.update({
        where: { id: ctx.gateway.id },
        data: {
          status: 'ONLINE',
          lastHeartbeatAt: now,
          version: dto.version ?? ctx.gateway.version,
          ipAddress: dto.ipAddress ?? ctx.gateway.ipAddress,
        },
      });
      const pendingCommands = await this.prisma.deviceCommand.count({
        where: {
          organizationId: ctx.organizationId,
          status: 'PENDING',
          device: { edgeGatewayId: ctx.gateway.id },
        },
      });
      return { ok: true, kind: 'gateway', pendingCommands };
    }

    if (ctx.device) {
      await this.prisma.device.update({
        where: { id: ctx.device.id },
        data: { status: 'ONLINE', lastSeenAt: now },
      });
      const pendingCommands = await this.prisma.deviceCommand.count({
        where: { deviceId: ctx.device.id, status: 'PENDING' },
      });
      return { ok: true, kind: 'device', pendingCommands };
    }

    throw new BadRequestException('Unresolved device context');
  }

  async ingest(ctx: DeviceAuthContext, events: IngestEventDto[]) {
    let accepted = 0;
    let duplicates = 0;
    let routed = 0;

    for (const ev of events) {
      const device = await this.resolveDevice(ctx, ev.deviceCode);

      if (ev.dedupeKey) {
        const existing = await this.prisma.deviceEvent.findFirst({
          where: {
            organizationId: ctx.organizationId,
            dedupeKey: ev.dedupeKey,
          },
          select: { id: true },
        });
        if (existing) {
          duplicates++;
          continue;
        }
      }

      const record = await this.prisma.deviceEvent.create({
        data: {
          organizationId: ctx.organizationId,
          deviceId: device.id,
          type: ev.type,
          dedupeKey: ev.dedupeKey,
          payload: ev.payload as Prisma.InputJsonValue,
          capturedAt: new Date(ev.capturedAt),
        },
      });
      accepted++;

      const routedTo = await this.route(ctx, ev, device.id);
      if (routedTo) routed++;
      await this.prisma.deviceEvent.update({
        where: { id: record.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          routedTo,
        },
      });

      // Keep device liveness fresh on any inbound event.
      await this.prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date(), status: 'ONLINE' },
      });
    }

    return { accepted, duplicates, routed };
  }

  /**
   * Route a recognized event into its owning domain. Returns the domain name
   * when routed, or null when the event is stored-only (still auditable).
   */
  private async route(
    ctx: DeviceAuthContext,
    ev: IngestEventDto,
    deviceId: string,
  ): Promise<string | null> {
    const systemUser: AuthUser = {
      id: `device:${deviceId}`,
      email: 'device@system.pssms',
      organizationId: ctx.organizationId,
      fullName: 'Device Ingestion',
      roles: ['DEVICE'],
      permissions: [],
      allowedBranchIds: [],
      allowedSiteIds: [],
    };

    try {
      if (ev.type === DeviceEventType.ANPR_RESULT) {
        const p = ev.payload as Record<string, unknown>;
        await this.parking.ingestAnprResult(
          {
            siteId: String(p.siteId ?? ''),
            gateId: p.gateId ? String(p.gateId) : undefined,
            plateNumber: String(p.plateNumber ?? ''),
            confidence: Number(p.confidence ?? 0),
            cameraId: p.cameraId ? String(p.cameraId) : undefined,
            imageUrl: p.imageUrl ? String(p.imageUrl) : undefined,
            rawPayload: p,
            capturedAt: ev.capturedAt,
          },
          systemUser,
        );
        return 'parking';
      }
    } catch (err) {
      this.logger.warn(
        `Routing failed for ${ev.type}: ${(err as Error).message}`,
      );
      throw err;
    }

    // ATTENDANCE_PUNCH / FINGERPRINT_SCAN / FACE_RECOGNITION / CARD_TAP /
    // QR_SCAN / CCTV_EVENT / PRINT_JOB_RESULT / ENROLLMENT_RESULT are stored in
    // the append-only log; domain routing (attendance/access/visitors) is wired
    // incrementally on top of this foundation.
    return null;
  }

  private async resolveDevice(ctx: DeviceAuthContext, deviceCode?: string) {
    if (ctx.kind === 'device' && ctx.device) {
      return ctx.device;
    }
    if (!deviceCode) {
      throw new BadRequestException(
        'deviceCode is required when authenticating as an edge gateway',
      );
    }
    const device = await this.prisma.device.findFirst({
      where: { organizationId: ctx.organizationId, code: deviceCode },
    });
    if (!device) {
      throw new BadRequestException(`Unknown device code: ${deviceCode}`);
    }
    if (
      ctx.gateway &&
      device.edgeGatewayId &&
      device.edgeGatewayId !== ctx.gateway.id
    ) {
      throw new BadRequestException(
        `Device ${deviceCode} is not bound to this gateway`,
      );
    }
    return device;
  }
}
