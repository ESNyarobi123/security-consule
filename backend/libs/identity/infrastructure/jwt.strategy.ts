import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AuthUser } from '@pssms/shared';
import * as jwt from 'jsonwebtoken';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { KeycloakUserMapperService } from '../application/keycloak-user-mapper.service';
import { OidcConfigService } from '../application/oidc-config.service';

type LocalJwtPayload = AuthUser & { sub: string; typ?: string; iss?: string };

/**
 * Dual JWT (AUTH_MODE=dual|local|keycloak).
 * Routes by `iss` then enforces alg per path (Keycloak → RS256 only, local → HS256 only)
 * to prevent HS/RS algorithm-confusion attacks (WorkOS / Auth0 guidance).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly keycloakIssuer: string | null;

  constructor(
    config: ConfigService,
    private readonly oidc: OidcConfigService,
    private readonly keycloakMapper: KeycloakUserMapperService,
  ) {
    const issuer = oidc.getIssuer();
    const jwksUri = oidc.getJwksUri(issuer);
    const jwtSecret = config.get<string>(
      'JWT_SECRET',
      'change_me_long_random_string',
    )!;
    const allowsKeycloak = oidc.allowsKeycloakTokens();
    const allowsLocal = oidc.allowsLocalTokens();

    const jwksSecret =
      jwksUri != null
        ? passportJwtSecret({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 10,
            jwksUri,
          })
        : null;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Both allowed at strategy level so dual mode works; secretOrKeyProvider
      // rejects mismatched `alg` before the wrong key type is used.
      algorithms: ['HS256', 'RS256'],
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (err: Error | null, secretOrKey?: string | Buffer) => void,
      ) => {
        try {
          const decoded = jwt.decode(rawJwtToken, { complete: true }) as {
            header?: { alg?: string };
            payload?: { iss?: string };
          } | null;
          const alg = decoded?.header?.alg;
          const iss = decoded?.payload?.iss;
          const isKeycloak = !!iss && !!issuer && iss === issuer;

          if (isKeycloak) {
            if (!allowsKeycloak || !jwksSecret) {
              return done(
                new UnauthorizedException(
                  'Keycloak tokens are not accepted in the current AUTH_MODE',
                ),
              );
            }
            if (alg !== 'RS256') {
              return done(
                new UnauthorizedException(
                  'Keycloak tokens must use RS256',
                ),
              );
            }
            return jwksSecret(_request, rawJwtToken, done);
          }

          if (!allowsLocal) {
            return done(
              new UnauthorizedException(
                'Local tokens are not accepted in the current AUTH_MODE',
              ),
            );
          }
          if (alg !== 'HS256') {
            return done(
              new UnauthorizedException('Local tokens must use HS256'),
            );
          }
          return done(null, jwtSecret);
        } catch (err) {
          return done(err as Error);
        }
      },
    });

    this.keycloakIssuer = issuer;
  }

  async validate(
    payload: LocalJwtPayload & {
      preferred_username?: string;
      email?: string;
      email_verified?: boolean;
      azp?: string;
      aud?: string | string[];
    },
  ): Promise<AuthUser> {
    const isKeycloak =
      !!payload.iss &&
      !!this.keycloakIssuer &&
      payload.iss === this.keycloakIssuer;

    if (isKeycloak) {
      const allowed = this.oidc.getAllowedAzp();
      if (allowed.length > 0) {
        const azp = payload.azp;
        if (!azp || !allowed.includes(azp)) {
          throw new UnauthorizedException({
            error: 'UNAUTHORIZED',
            message: 'Keycloak token client (azp) is not allowed',
          });
        }
      }
      return this.keycloakMapper.mapToAuthUser({
        sub: payload.sub,
        iss: payload.iss,
        email: payload.email,
        preferred_username: payload.preferred_username,
        email_verified: payload.email_verified,
      });
    }

    return {
      id: payload.sub ?? payload.id,
      email: payload.email,
      organizationId: payload.organizationId,
      fullName: payload.fullName,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      allowedBranchIds: payload.allowedBranchIds ?? [],
      allowedSiteIds: payload.allowedSiteIds ?? [],
      customerId: payload.customerId ?? null,
      supplierId: payload.supplierId ?? null,
    };
  }
}
