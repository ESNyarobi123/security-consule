import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { hashDeviceKey } from '../infrastructure/device-auth.guard';
import {
  DeviceResponseDto,
  EdgeGatewayResponseDto,
  RegisterDeviceDto,
  RegisterEdgeGatewayDto,
  UpdateDeviceDto,
} from '../presentation/dto/device.dto';

const CCTV_DEVICE_TYPE = 'CCTV_CAMERA';
const CCTV_EVENT_TYPE = 'CCTV_EVENT';

/** Has cctv.manage but not full ops — mosaic / camera metadata only. */
function isCctvScoped(user: AuthUser): boolean {
  return (
    user.permissions.includes('cctv.manage') &&
    !user.permissions.includes('operations.manage') &&
    !user.roles.includes('SUPER_ADMIN')
  );
}

function generateKey(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`;
}

type SiteLabel = { id: string; code: string; name: string };

/** CCTV mosaic URLs must be http(s) only — never javascript: / data: embeds. */
const CCTV_URL_KEYS = ['embedUrl', 'streamUrl', 'snapshotUrl'] as const;

function assertHttpUrl(value: unknown, key: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${key} must be a non-empty http(s) URL`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new BadRequestException(`${key} must be a valid http(s) URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(`${key} must use http or https`);
  }
  return parsed.toString();
}

function sanitizeDeviceConfig(
  config: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!config) return undefined;
  const out: Record<string, unknown> = { ...config };
  for (const key of CCTV_URL_KEYS) {
    if (out[key] == null || out[key] === '') {
      delete out[key];
      continue;
    }
    out[key] = assertHttpUrl(out[key], key);
  }
  return out as Prisma.InputJsonValue;
}

@Injectable()
export class DeviceRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Edge gateways ──────────────────────────────────────────────
  async registerGateway(dto: RegisterEdgeGatewayDto, user: AuthUser) {
    this.assertFullOpsDevices(user);
    if (dto.siteId) {
      await this.assertSiteInOrg(dto.siteId, user.organizationId);
    }
    const apiKey = generateKey('gw');
    const gateway = await this.prisma.edgeGateway.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        code: dto.code,
        name: dto.name,
        version: dto.version,
        apiKeyHash: hashDeviceKey(apiKey),
        createdBy: user.id,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'devices.gateway.registered',
      resourceType: 'EdgeGateway',
      resourceId: gateway.id,
      after: { code: gateway.code, name: gateway.name },
    });
    // apiKey is returned exactly once — it is not recoverable afterwards.
    const siteById = await this.loadSiteLabels(user.organizationId, [
      gateway.siteId,
    ]);
    return { ...this.gatewayView(gateway, siteById), apiKey };
  }

  async listGateways(user: AuthUser): Promise<EdgeGatewayResponseDto[]> {
    this.assertFullOpsDevices(user);
    const rows = await this.prisma.edgeGateway.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    const siteById = await this.loadSiteLabels(
      user.organizationId,
      rows.map((g) => g.siteId),
    );
    return rows.map((g) => this.gatewayView(g, siteById));
  }

  // ── Devices ────────────────────────────────────────────────────
  async registerDevice(dto: RegisterDeviceDto, user: AuthUser) {
    if (isCctvScoped(user) && dto.type !== CCTV_DEVICE_TYPE) {
      throw new ForbiddenException({
        error: 'CCTV_SCOPE_DENIED',
        message: 'CCTV operators may only register CCTV_CAMERA devices',
      });
    }
    if (isCctvScoped(user) && dto.directPush) {
      throw new ForbiddenException({
        error: 'CCTV_SCOPE_DENIED',
        message:
          'CCTV operators cannot mint device API keys (directPush) — ops only',
      });
    }
    if (dto.siteId) {
      await this.assertSiteInOrg(dto.siteId, user.organizationId);
    }
    if (dto.edgeGatewayId) {
      const gw = await this.prisma.edgeGateway.findFirst({
        where: { id: dto.edgeGatewayId, organizationId: user.organizationId },
      });
      if (!gw) throw new BadRequestException('Edge gateway not found');
    }

    let apiKey: string | undefined;
    let apiKeyHash: string | undefined;
    if (dto.directPush) {
      apiKey = generateKey('dvc');
      apiKeyHash = hashDeviceKey(apiKey);
    }

    const device = await this.prisma.device.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        gateId: dto.gateId,
        edgeGatewayId: dto.edgeGatewayId,
        type: dto.type,
        connection: dto.connection,
        code: dto.code,
        name: dto.name,
        vendor: dto.vendor,
        model: dto.model,
        serialNumber: dto.serialNumber,
        apiKeyHash,
        config: sanitizeDeviceConfig(
          dto.config as Record<string, unknown> | undefined,
        ),
        createdBy: user.id,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'devices.device.registered',
      resourceType: 'Device',
      resourceId: device.id,
      after: { code: device.code, type: device.type },
    });
    const siteById = await this.loadSiteLabels(user.organizationId, [
      device.siteId,
    ]);
    return { ...this.deviceView(device, siteById), apiKey };
  }

  async listDevices(
    user: AuthUser,
    filters: { type?: string; siteId?: string; status?: string } = {},
  ): Promise<DeviceResponseDto[]> {
    const typeFilter = isCctvScoped(user)
      ? CCTV_DEVICE_TYPE
      : filters.type;
    if (
      isCctvScoped(user) &&
      filters.type &&
      filters.type !== CCTV_DEVICE_TYPE
    ) {
      throw new ForbiddenException({
        error: 'CCTV_SCOPE_DENIED',
        message: 'CCTV operators may only list CCTV_CAMERA devices',
      });
    }
    const rows = await this.prisma.device.findMany({
      where: {
        organizationId: user.organizationId,
        ...(typeFilter ? { type: typeFilter as never } : {}),
        siteId: filters.siteId,
        status: filters.status as never,
      },
      orderBy: { createdAt: 'desc' },
    });
    const siteById = await this.loadSiteLabels(
      user.organizationId,
      rows.map((d) => d.siteId),
    );
    return rows.map((d) => this.deviceView(d, siteById));
  }

  listEvents(
    user: AuthUser,
    filters: { type?: string; deviceId?: string } = {},
  ) {
    const typeFilter = isCctvScoped(user)
      ? CCTV_EVENT_TYPE
      : filters.type;
    if (
      isCctvScoped(user) &&
      filters.type &&
      filters.type !== CCTV_EVENT_TYPE
    ) {
      throw new ForbiddenException({
        error: 'CCTV_SCOPE_DENIED',
        message: 'CCTV operators may only list CCTV_EVENT metadata',
      });
    }
    return this.prisma.deviceEvent.findMany({
      where: {
        organizationId: user.organizationId,
        ...(typeFilter ? { type: typeFilter as never } : {}),
        ...(filters.deviceId ? { deviceId: filters.deviceId } : {}),
      },
      orderBy: { capturedAt: 'desc' },
      take: 50,
      include: {
        device: { select: { id: true, code: true, name: true, type: true } },
      },
    });
  }

  async findBySerial(serialNumber: string) {
    const device = await this.prisma.device.findFirst({
      where: { serialNumber },
    });
    if (!device) {
      throw new NotFoundException(`No device with serial ${serialNumber}`);
    }
    return device;
  }

  async getDevice(id: string, user: AuthUser) {
    const device = await this.prisma.device.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!device) throw new NotFoundException('Device not found');
    this.assertCctvDeviceAccess(user, device.type);
    const [eventCount, pendingCommands] = await Promise.all([
      this.prisma.deviceEvent.count({ where: { deviceId: id } }),
      this.prisma.deviceCommand.count({
        where: { deviceId: id, status: 'PENDING' },
      }),
    ]);
    const siteById = await this.loadSiteLabels(user.organizationId, [
      device.siteId,
    ]);
    return {
      ...this.deviceView(device, siteById),
      eventCount,
      pendingCommands,
    };
  }

  async updateDevice(id: string, dto: UpdateDeviceDto, user: AuthUser) {
    const device = await this.prisma.device.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!device) throw new NotFoundException('Device not found');
    this.assertCctvDeviceAccess(user, device.type);
    if (dto.siteId) {
      await this.assertSiteInOrg(dto.siteId, user.organizationId);
    }
    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        siteId: dto.siteId,
        gateId: dto.gateId,
        config:
          dto.config !== undefined
            ? sanitizeDeviceConfig(
                dto.config as Record<string, unknown> | undefined,
              )
            : undefined,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'devices.device.updated',
      resourceType: 'Device',
      resourceId: id,
      before: { status: device.status },
      after: { status: updated.status },
    });
    const siteById = await this.loadSiteLabels(user.organizationId, [
      updated.siteId,
    ]);
    return this.deviceView(updated, siteById);
  }

  private assertFullOpsDevices(user: AuthUser): void {
    if (
      user.permissions.includes('operations.manage') ||
      user.roles.includes('SUPER_ADMIN')
    ) {
      return;
    }
    throw new ForbiddenException({
      error: 'CCTV_SCOPE_DENIED',
      message: 'Edge gateways require operations.manage',
    });
  }

  private assertCctvDeviceAccess(user: AuthUser, deviceType: string): void {
    if (!isCctvScoped(user)) return;
    if (deviceType !== CCTV_DEVICE_TYPE) {
      throw new ForbiddenException({
        error: 'CCTV_SCOPE_DENIED',
        message: 'CCTV operators may only access CCTV_CAMERA devices',
      });
    }
  }

  private async assertSiteInOrg(siteId: string, organizationId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, organizationId },
    });
    if (!site) throw new BadRequestException('Site not found in organization');
  }

  /** Org-scoped batch site labels (same pattern as guards list). */
  private async loadSiteLabels(
    organizationId: string,
    siteIds: Array<string | null | undefined>,
  ): Promise<Map<string, SiteLabel>> {
    const ids = [
      ...new Set(siteIds.filter((id): id is string => Boolean(id))),
    ];
    if (ids.length === 0) return new Map();
    const sites = await this.prisma.site.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, code: true, name: true },
    });
    return new Map(sites.map((s) => [s.id, s]));
  }

  private gatewayView(
    g: {
      id: string;
      code: string;
      name: string;
      siteId: string | null;
      status: string;
      version: string | null;
      lastHeartbeatAt: Date | null;
      createdAt: Date;
    },
    siteById?: Map<string, SiteLabel>,
  ): EdgeGatewayResponseDto {
    const site = g.siteId ? siteById?.get(g.siteId) : undefined;
    return {
      id: g.id,
      code: g.code,
      name: g.name,
      siteId: g.siteId,
      siteCode: site?.code ?? null,
      siteName: site?.name ?? null,
      status: g.status,
      version: g.version,
      lastHeartbeatAt: g.lastHeartbeatAt,
      createdAt: g.createdAt,
    };
  }

  private deviceView(
    d: {
      id: string;
      code: string;
      name: string;
      type: string;
      connection: string;
      siteId: string | null;
      gateId: string | null;
      edgeGatewayId: string | null;
      status: string;
      vendor: string | null;
      model: string | null;
      serialNumber: string | null;
      lastSeenAt: Date | null;
      createdAt: Date;
      config?: Prisma.JsonValue | null;
    },
    siteById?: Map<string, SiteLabel>,
  ): DeviceResponseDto {
    const site = d.siteId ? siteById?.get(d.siteId) : undefined;
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      type: d.type as DeviceResponseDto['type'],
      connection: d.connection as DeviceResponseDto['connection'],
      siteId: d.siteId,
      siteCode: site?.code ?? null,
      siteName: site?.name ?? null,
      gateId: d.gateId,
      edgeGatewayId: d.edgeGatewayId,
      status: d.status as DeviceResponseDto['status'],
      vendor: d.vendor,
      model: d.model,
      serialNumber: d.serialNumber,
      lastSeenAt: d.lastSeenAt,
      createdAt: d.createdAt,
      // Nest stores stream/embed/snapshot URLs + mosaic metadata only — never video bytes.
      config: (d.config as Record<string, unknown> | null) ?? null,
    };
  }
}
