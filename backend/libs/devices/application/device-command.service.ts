import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { DeviceAuthContext } from '../infrastructure/device-auth.guard';
import { AckCommandDto, IssueCommandDto } from '../presentation/dto/device.dto';

@Injectable()
export class DeviceCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async issue(deviceId: string, dto: IssueCommandDto, user: AuthUser) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, organizationId: user.organizationId },
    });
    if (!device) throw new NotFoundException('Device not found');

    const ttl = dto.expiresInSeconds ?? 300;
    const command = await this.prisma.deviceCommand.create({
      data: {
        organizationId: user.organizationId,
        deviceId,
        type: dto.type,
        payload: (dto.payload as Prisma.InputJsonValue) ?? undefined,
        issuedById: user.id,
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'devices.command.issued',
      resourceType: 'DeviceCommand',
      resourceId: command.id,
      after: { deviceId, type: dto.type },
    });
    return command;
  }

  listForDevice(deviceId: string, user: AuthUser) {
    return this.prisma.deviceCommand.findMany({
      where: { deviceId, organizationId: user.organizationId },
      orderBy: { issuedAt: 'desc' },
      take: 50,
    });
  }

  /** Device/gateway polls for pending work. Returns and marks them DISPATCHED. */
  async poll(ctx: DeviceAuthContext) {
    const now = new Date();
    const where: Prisma.DeviceCommandWhereInput = {
      organizationId: ctx.organizationId,
      status: 'PENDING',
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(ctx.kind === 'device' && ctx.device
        ? { deviceId: ctx.device.id }
        : { device: { edgeGatewayId: ctx.gateway?.id } }),
    };

    const pending = await this.prisma.deviceCommand.findMany({
      where,
      orderBy: { issuedAt: 'asc' },
      take: 25,
    });
    if (pending.length === 0) return { commands: [] };

    await this.prisma.deviceCommand.updateMany({
      where: { id: { in: pending.map((c) => c.id) } },
      data: { status: 'DISPATCHED', dispatchedAt: now },
    });

    return {
      commands: pending.map((c) => ({
        id: c.id,
        deviceId: c.deviceId,
        type: c.type,
        payload: c.payload,
      })),
    };
  }

  async ack(ctx: DeviceAuthContext, id: string, dto: AckCommandDto) {
    const command = await this.prisma.deviceCommand.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!command) throw new NotFoundException('Command not found');
    if (dto.status !== 'ACKED' && dto.status !== 'FAILED') {
      throw new BadRequestException('status must be ACKED or FAILED');
    }
    return this.prisma.deviceCommand.update({
      where: { id },
      data: {
        status: dto.status,
        result: (dto.result as Prisma.InputJsonValue) ?? undefined,
        acknowledgedAt: new Date(),
      },
    });
  }
}
