import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { hashDeviceKey } from '../infrastructure/device-auth.guard';
import {
  RegisterDeviceDto,
  RegisterEdgeGatewayDto,
  UpdateDeviceDto,
} from '../presentation/dto/device.dto';

function generateKey(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`;
}

@Injectable()
export class DeviceRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Edge gateways ──────────────────────────────────────────────
  async registerGateway(dto: RegisterEdgeGatewayDto, user: AuthUser) {
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
    return { ...this.gatewayView(gateway), apiKey };
  }

  listGateways(user: AuthUser) {
    return this.prisma.edgeGateway
      .findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => rows.map((g) => this.gatewayView(g)));
  }

  // ── Devices ────────────────────────────────────────────────────
  async registerDevice(dto: RegisterDeviceDto, user: AuthUser) {
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
        config: (dto.config as Prisma.InputJsonValue) ?? undefined,
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
    return { ...this.deviceView(device), apiKey };
  }

  listDevices(
    user: AuthUser,
    filters: { type?: string; siteId?: string; status?: string } = {},
  ) {
    return this.prisma.device
      .findMany({
        where: {
          organizationId: user.organizationId,
          type: filters.type as never,
          siteId: filters.siteId,
          status: filters.status as never,
        },
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => rows.map((d) => this.deviceView(d)));
  }

  async getDevice(id: string, user: AuthUser) {
    const device = await this.prisma.device.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!device) throw new NotFoundException('Device not found');
    const [eventCount, pendingCommands] = await Promise.all([
      this.prisma.deviceEvent.count({ where: { deviceId: id } }),
      this.prisma.deviceCommand.count({
        where: { deviceId: id, status: 'PENDING' },
      }),
    ]);
    return { ...this.deviceView(device), eventCount, pendingCommands };
  }

  async updateDevice(id: string, dto: UpdateDeviceDto, user: AuthUser) {
    const device = await this.prisma.device.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!device) throw new NotFoundException('Device not found');
    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        siteId: dto.siteId,
        gateId: dto.gateId,
        config: (dto.config as Prisma.InputJsonValue) ?? undefined,
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
    return this.deviceView(updated);
  }

  private gatewayView(g: {
    id: string;
    code: string;
    name: string;
    siteId: string | null;
    status: string;
    version: string | null;
    lastHeartbeatAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: g.id,
      code: g.code,
      name: g.name,
      siteId: g.siteId,
      status: g.status,
      version: g.version,
      lastHeartbeatAt: g.lastHeartbeatAt,
      createdAt: g.createdAt,
    };
  }

  private deviceView(d: {
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
  }) {
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      type: d.type,
      connection: d.connection,
      siteId: d.siteId,
      gateId: d.gateId,
      edgeGatewayId: d.edgeGatewayId,
      status: d.status,
      vendor: d.vendor,
      model: d.model,
      serialNumber: d.serialNumber,
      lastSeenAt: d.lastSeenAt,
      createdAt: d.createdAt,
    };
  }
}
