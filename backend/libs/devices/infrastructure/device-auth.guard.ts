import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService, AuthUser } from '@pssms/shared';
import { Device, EdgeGateway } from '@prisma/client';

export interface DeviceAuthContext {
  kind: 'device' | 'gateway';
  organizationId: string;
  device?: Device;
  gateway?: EdgeGateway;
}

export function hashDeviceKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Authenticates device-facing endpoints via `X-Device-Key` (network terminals
 * that push directly) or `X-Gateway-Key` (site edge gateways forwarding USB
 * device traffic). Sets a pseudo `AuthUser` scoped to the device's organization
 * so the RLS org context binds correctly for downstream writes.
 *
 * The registry tables are NOT under RLS, so this pre-auth key lookup works
 * before any org GUC is set.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
      deviceAuth?: DeviceAuthContext;
    }>();

    const gatewayKey = req.headers['x-gateway-key'];
    const deviceKey = req.headers['x-device-key'];

    let ctx: DeviceAuthContext | null = null;

    if (gatewayKey) {
      const gateway = await this.prisma.edgeGateway.findFirst({
        where: { apiKeyHash: hashDeviceKey(gatewayKey) },
      });
      if (gateway && gateway.status !== 'DISABLED') {
        ctx = {
          kind: 'gateway',
          organizationId: gateway.organizationId,
          gateway,
        };
      }
    } else if (deviceKey) {
      const device = await this.prisma.device.findFirst({
        where: { apiKeyHash: hashDeviceKey(deviceKey) },
      });
      if (device && device.status !== 'DISABLED') {
        ctx = { kind: 'device', organizationId: device.organizationId, device };
      }
    }

    if (!ctx) {
      throw new UnauthorizedException('Invalid or disabled device credentials');
    }

    req.deviceAuth = ctx;
    req.user = {
      id: ctx.device?.id ?? ctx.gateway?.id ?? 'device',
      email: `device:${ctx.device?.code ?? ctx.gateway?.code ?? 'unknown'}`,
      organizationId: ctx.organizationId,
      fullName: ctx.device?.name ?? ctx.gateway?.name ?? 'Device',
      roles: ['DEVICE'],
      permissions: [],
      allowedBranchIds: [],
      allowedSiteIds: [],
    };
    return true;
  }
}

export const DeviceContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceAuthContext => {
    return ctx.switchToHttp().getRequest<{ deviceAuth: DeviceAuthContext }>()
      .deviceAuth;
  },
);
