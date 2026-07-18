import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService, verifyTotp } from '@pssms/shared';
import { AuthUser } from '@pssms/shared';
import {
  AuthUserProfileDto,
  LoginDto,
  LoginResponseDto,
} from '../presentation/dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(
    dto: LoginDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        branchAccess: true,
        siteAccess: true,
      },
    });

    const fail = async () => {
      if (user) {
        await this.prisma.loginHistory.create({
          data: {
            userId: user.id,
            ipAddress: meta?.ip,
            userAgent: meta?.userAgent,
            success: false,
          },
        });
      }
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    };

    if (!user || !user.isActive) {
      await fail();
    }

    const valid = await bcrypt.compare(dto.password, user!.passwordHash);
    if (!valid) {
      await fail();
    }

    // MFA step-up: when enabled, a valid TOTP code is mandatory.
    if (user!.mfaEnabled) {
      if (!dto.mfaCode) {
        throw new UnauthorizedException({
          error: 'MFA_REQUIRED',
          message: 'Multi-factor authentication code is required',
        });
      }
      if (!user!.mfaSecret || !verifyTotp(user!.mfaSecret, dto.mfaCode)) {
        await this.prisma.loginHistory.create({
          data: {
            userId: user!.id,
            ipAddress: meta?.ip,
            userAgent: meta?.userAgent,
            success: false,
          },
        });
        throw new UnauthorizedException({
          error: 'MFA_INVALID_CODE',
          message: 'Invalid authentication code',
        });
      }
    }

    const profile = this.toProfile(user!);
    const tokens = await this.issueTokens(profile);

    await this.prisma.$transaction([
      this.prisma.loginHistory.create({
        data: {
          userId: user!.id,
          ipAddress: meta?.ip,
          userAgent: meta?.userAgent,
          success: true,
        },
      }),
      this.prisma.user.update({
        where: { id: user!.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    return { tokens, user: profile };
  }

  async refresh(refreshToken: string): Promise<LoginResponseDto['tokens']> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        typ?: string;
      }>(refreshToken, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      if (payload.typ !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const profile = await this.loadProfile(payload.sub);
      return this.issueTokens(profile);
    } catch {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      });
    }
  }

  async me(userId: string): Promise<AuthUserProfileDto> {
    return this.loadProfile(userId);
  }

  async loadProfile(userId: string): Promise<AuthUserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        branchAccess: true,
        siteAccess: true,
      },
    });
    if (!user || !user.isActive) {
      throw new ForbiddenException('User inactive or not found');
    }
    return this.toProfile(user);
  }

  private toProfile(user: {
    id: string;
    email: string;
    fullName: string;
    organizationId: string;
    customerId?: string | null;
    supplierId?: string | null;
    roles: Array<{
      role: {
        code: string;
        permissions: Array<{ permission: { code: string } }>;
      };
    }>;
    branchAccess: Array<{ branchId: string }>;
    siteAccess: Array<{ siteId: string }>;
  }): AuthUserProfileDto {
    const roles = user.roles.map((r) => r.role.code);
    const permissions = [
      ...new Set(
        user.roles.flatMap((r) =>
          r.role.permissions.map((p) => p.permission.code),
        ),
      ),
    ];
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: user.organizationId,
      customerId: user.customerId ?? null,
      supplierId: user.supplierId ?? null,
      roles,
      permissions,
      allowedBranchIds: user.branchAccess.map((b) => b.branchId),
      allowedSiteIds: user.siteAccess.map((s) => s.siteId),
    };
  }

  private async issueTokens(user: AuthUserProfileDto) {
    const accessPayload: AuthUser & { sub: string } = {
      sub: user.id,
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      fullName: user.fullName,
      roles: user.roles,
      permissions: user.permissions,
      allowedBranchIds: user.allowedBranchIds,
      allowedSiteIds: user.allowedSiteIds,
      customerId: user.customerId ?? null,
      supplierId: user.supplierId ?? null,
    };

    const expiresIn = this.config.get('JWT_EXPIRES_IN', '15m') as `${number}m`;
    const refreshExpires = this.config.get(
      'REFRESH_TOKEN_EXPIRES_IN',
      '7d',
    ) as `${number}d`;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, { expiresIn }),
      this.jwt.signAsync(
        { sub: user.id, typ: 'refresh' },
        { expiresIn: refreshExpires },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }
}
