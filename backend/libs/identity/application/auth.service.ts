import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import {
  PrismaService,
  verifyTotp,
  evaluatePasswordPolicy,
} from '@pssms/shared';
import { AuthUser } from '@pssms/shared';
import {
  AuthUserProfileDto,
  ChangePasswordDto,
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

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new ForbiddenException('User inactive or not found');
    }

    const currentOk = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentOk) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Current password is incorrect',
      });
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        error: 'SAME_PASSWORD',
        message: 'New password must be different from the current password',
      });
    }

    const policyFailures = evaluatePasswordPolicy(dto.newPassword);
    if (policyFailures.length > 0) {
      throw new BadRequestException({
        error: 'WEAK_PASSWORD',
        message: `Password must contain ${policyFailures.join(', ')}`,
      });
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    const profile = await this.loadProfile(userId);
    const tokens = await this.issueTokens(profile);
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
    mustChangePassword?: boolean;
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
      mustChangePassword: user.mustChangePassword === true,
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
      mustChangePassword: user.mustChangePassword === true,
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
