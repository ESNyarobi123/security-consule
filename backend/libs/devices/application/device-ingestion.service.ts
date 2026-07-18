import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, DeviceEventType, Device, AccessMethod } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { ParkingService } from '@pssms/parking';
import { AccessControlService } from '@pssms/access-control';
import { VisitorsService } from '@pssms/visitors';
import { AttendanceService } from '@pssms/attendance';
import { DeviceAuthContext } from '../infrastructure/device-auth.guard';
import { HeartbeatDto, IngestEventDto } from '../presentation/dto/device.dto';

type RouteTarget = 'attendance' | 'access' | 'visitors' | 'parking';

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
    private readonly access: AccessControlService,
    private readonly visitors: VisitorsService,
    private readonly attendance: AttendanceService,
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

      const routedTo = await this.route(ctx, ev, device);
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
  /**
   * Route a recognized event into its owning domain. Resolution of physical
   * identifiers (plate / card / biometric / QR / employee number) belongs to
   * each domain, so we only normalize + dispatch here.
   *
   * Target is chosen by an explicit `device.config.route` hint, else a sensible
   * default per event type. Routing failures are logged and downgraded to
   * store-only (returns null) so a misconfigured device never rejects the
   * whole ingest batch — the raw event is always persisted + auditable.
   */
  private async route(
    ctx: DeviceAuthContext,
    ev: IngestEventDto,
    device: Device,
  ): Promise<string | null> {
    const systemUser: AuthUser = {
      id: `device:${device.id}`,
      email: 'device@system.pssms',
      organizationId: ctx.organizationId,
      fullName: 'Device Ingestion',
      roles: ['DEVICE'],
      permissions: [],
      allowedBranchIds: [],
      allowedSiteIds: [],
    };

    const p = ev.payload as Record<string, unknown>;
    const cfg = (device.config ?? {}) as Record<string, unknown>;
    const target = this.resolveTarget(ev.type, cfg);
    if (!target) return null;

    const siteId = device.siteId ?? (p.siteId ? String(p.siteId) : undefined);
    const gateId = device.gateId ?? (p.gateId ? String(p.gateId) : undefined);
    const direction = this.parseDirection(p.direction);

    try {
      if (target === 'parking') {
        await this.parking.ingestAnprResult(
          {
            siteId: siteId ?? '',
            gateId,
            plateNumber: String(p.plateNumber ?? p.value ?? ''),
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

      if (target === 'visitors') {
        const code = String(p.code ?? p.value ?? '');
        if (!code || !siteId) return null;
        await this.visitors.gateVerify(
          { code, siteId, gateId, clientEventId: ev.dedupeKey },
          systemUser,
        );
        return 'visitors';
      }

      if (target === 'access') {
        const entry = await this.access.ingestDeviceEntry(
          {
            cardRef: this.pickRef(p, ['cardRef', 'card', 'value'], ev.type === DeviceEventType.CARD_TAP),
            biometricRef: this.pickRef(
              p,
              ['biometricRef', 'templateId', 'value'],
              ev.type === DeviceEventType.FINGERPRINT_SCAN ||
                ev.type === DeviceEventType.FACE_RECOGNITION,
            ),
            siteId,
            gateId,
            direction,
            accessMethod: this.mapAccessMethod(ev.type),
            capturedAt: ev.capturedAt,
            clientEventId: ev.dedupeKey,
          },
          systemUser,
        );
        return entry ? 'access' : null;
      }

      if (target === 'attendance') {
        const res = await this.attendance.ingestDevicePunch(
          {
            employeeNumber: String(p.employeeNumber ?? p.userId ?? p.value ?? ''),
            siteId,
            direction,
            eventType: ev.type,
            capturedAt: ev.capturedAt,
            clientEventId: ev.dedupeKey,
          },
          systemUser,
        );
        return res ? 'attendance' : null;
      }
    } catch (err) {
      this.logger.warn(
        `Routing to ${target} failed for ${ev.type} (device ${device.code}); ` +
          `kept store-only: ${(err as Error).message}`,
      );
      return null;
    }

    return null;
  }

  private resolveTarget(
    type: DeviceEventType,
    cfg: Record<string, unknown>,
  ): RouteTarget | null {
    const hint = typeof cfg.route === 'string' ? cfg.route.toLowerCase() : '';
    if (['attendance', 'access', 'visitors', 'parking'].includes(hint)) {
      return hint as RouteTarget;
    }
    switch (type) {
      case DeviceEventType.ANPR_RESULT:
        return 'parking';
      case DeviceEventType.ATTENDANCE_PUNCH:
        return 'attendance';
      case DeviceEventType.CARD_TAP:
      case DeviceEventType.FINGERPRINT_SCAN:
      case DeviceEventType.FACE_RECOGNITION:
        return 'access';
      case DeviceEventType.QR_SCAN:
        return 'visitors';
      default:
        // CCTV_EVENT / PRINT_JOB_RESULT / ENROLLMENT_RESULT / HEARTBEAT are
        // store-only (still auditable in the append-only log).
        return null;
    }
  }

  private parseDirection(value: unknown): 'IN' | 'OUT' | undefined {
    const v = String(value ?? '').toUpperCase();
    if (v === 'IN' || v === 'CHECK_IN' || v === 'ENTRY') return 'IN';
    if (v === 'OUT' || v === 'CHECK_OUT' || v === 'EXIT') return 'OUT';
    return undefined;
  }

  private pickRef(
    p: Record<string, unknown>,
    keys: string[],
    enabled: boolean,
  ): string | undefined {
    if (!enabled) {
      // Still honor an explicit ref key even when `value` fallback is disabled.
      for (const k of keys.filter((x) => x !== 'value')) {
        if (p[k] != null) return String(p[k]);
      }
      return undefined;
    }
    for (const k of keys) {
      if (p[k] != null) return String(p[k]);
    }
    return undefined;
  }

  private mapAccessMethod(type: DeviceEventType): AccessMethod {
    switch (type) {
      case DeviceEventType.FINGERPRINT_SCAN:
      case DeviceEventType.FACE_RECOGNITION:
        return AccessMethod.BIOMETRIC;
      case DeviceEventType.QR_SCAN:
        return AccessMethod.QR;
      case DeviceEventType.CARD_TAP:
      default:
        return AccessMethod.CARD;
    }
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
