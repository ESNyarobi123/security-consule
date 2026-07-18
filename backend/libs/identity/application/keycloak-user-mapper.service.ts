import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService } from '@pssms/shared';
import { AuthService } from './auth.service';

/** Keycloak access-token claims we care about (authZ still comes from Prisma). */
export interface KeycloakTokenClaims {
  sub: string;
  iss?: string;
  email?: string;
  preferred_username?: string;
  email_verified?: boolean;
}

@Injectable()
export class KeycloakUserMapperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Map a verified Keycloak JWT to AuthUser.
   * Roles/permissions/ABAC scope always load from the DB — never from realm roles.
   */
  async mapToAuthUser(claims: KeycloakTokenClaims): Promise<AuthUser> {
    const keycloakSub = claims.sub;
    if (!keycloakSub) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Keycloak token missing subject',
      });
    }

    let user = await this.prisma.user.findUnique({
      where: { keycloakSub },
    });

    if (!user) {
      if (claims.email_verified !== true) {
        throw new UnauthorizedException({
          error: 'USER_NOT_PROVISIONED',
          message: 'USER_NOT_PROVISIONED',
        });
      }

      const email = this.resolveEmail(claims);
      if (!email) {
        throw new UnauthorizedException({
          error: 'USER_NOT_PROVISIONED',
          message: 'USER_NOT_PROVISIONED',
        });
      }

      user = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });

      if (!user) {
        throw new UnauthorizedException({
          error: 'USER_NOT_PROVISIONED',
          message: 'USER_NOT_PROVISIONED',
        });
      }

      if (!user.keycloakSub) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { keycloakSub },
        });
        await this.audit.record({
          organizationId: user.organizationId,
          actorId: user.id,
          action: 'IDENTITY_KEYCLOAK_LINK',
          resourceType: 'User',
          resourceId: user.id,
          after: { keycloakSub },
        });
      } else if (user.keycloakSub !== keycloakSub) {
        throw new UnauthorizedException({
          error: 'USER_NOT_PROVISIONED',
          message: 'USER_NOT_PROVISIONED',
        });
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        error: 'USER_NOT_PROVISIONED',
        message: 'USER_NOT_PROVISIONED',
      });
    }

    const profile = await this.authService.loadProfile(user.id);
    return {
      id: profile.id,
      email: profile.email,
      organizationId: profile.organizationId,
      fullName: profile.fullName,
      roles: profile.roles,
      permissions: profile.permissions,
      allowedBranchIds: profile.allowedBranchIds,
      allowedSiteIds: profile.allowedSiteIds,
      customerId: profile.customerId ?? null,
      supplierId: profile.supplierId ?? null,
    };
  }

  private resolveEmail(claims: KeycloakTokenClaims): string | null {
    const raw = claims.email ?? claims.preferred_username;
    if (!raw || !raw.includes('@')) {
      return claims.email?.toLowerCase() ?? null;
    }
    return raw.toLowerCase();
  }
}
