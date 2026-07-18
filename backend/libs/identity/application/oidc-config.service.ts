import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AuthMode = 'local' | 'keycloak' | 'dual';

export interface OidcPublicConfig {
  authMode: AuthMode;
  issuer: string | null;
  jwksUri: string | null;
  clients: {
    api: string | null;
    adminWeb: string | null;
  };
  authorizationEndpoint: string | null;
  tokenEndpoint: string | null;
  /** True when HS256 local JWTs are accepted (local|dual). Login endpoint always exists for break-glass. */
  localLoginEnabled: boolean;
}

@Injectable()
export class OidcConfigService {
  constructor(private readonly config: ConfigService) {}

  getAuthMode(): AuthMode {
    const raw = (
      this.config.get<string>('AUTH_MODE', 'dual') ?? 'dual'
    ).toLowerCase();
    if (raw === 'local' || raw === 'keycloak' || raw === 'dual') {
      return raw;
    }
    return 'dual';
  }

  allowsKeycloakTokens(): boolean {
    const mode = this.getAuthMode();
    return mode === 'keycloak' || mode === 'dual';
  }

  allowsLocalTokens(): boolean {
    const mode = this.getAuthMode();
    return mode === 'local' || mode === 'dual';
  }

  /** KEYCLOAK_ISSUER or KEYCLOAK_URL/realms/KEYCLOAK_REALM */
  getIssuer(): string | null {
    const explicit = this.config.get<string>('KEYCLOAK_ISSUER')?.trim();
    if (explicit) {
      return explicit.replace(/\/$/, '');
    }
    const base = this.config.get<string>('KEYCLOAK_URL')?.replace(/\/$/, '');
    const realm = this.config.get<string>('KEYCLOAK_REALM');
    if (!base || !realm) {
      return null;
    }
    return `${base}/realms/${realm}`;
  }

  getJwksUri(issuer = this.getIssuer()): string | null {
    if (!issuer) {
      return null;
    }
    return `${issuer}/protocol/openid-connect/certs`;
  }

  /** Authorized parties for Keycloak access tokens (portal + API ROPC clients). */
  getAllowedAzp(): string[] {
    const raw = this.config.get<string>('KEYCLOAK_ALLOWED_AZP')?.trim();
    if (raw) {
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const clients = [
      this.config.get<string>('KEYCLOAK_ADMIN_WEB_CLIENT_ID') ??
        'pssms-admin-web',
      this.config.get<string>('KEYCLOAK_CLIENT_ID') ?? 'pssms-api',
    ];
    return [...new Set(clients.filter(Boolean))];
  }

  getPublicConfig(): OidcPublicConfig {
    const authMode = this.getAuthMode();
    const issuer = this.getIssuer();
    const jwksUri = this.getJwksUri(issuer);
    return {
      authMode,
      issuer,
      jwksUri,
      clients: {
        api: this.config.get<string>('KEYCLOAK_CLIENT_ID') ?? null,
        adminWeb:
          this.config.get<string>('KEYCLOAK_ADMIN_WEB_CLIENT_ID') ??
          'pssms-admin-web',
      },
      authorizationEndpoint: issuer
        ? `${issuer}/protocol/openid-connect/auth`
        : null,
      tokenEndpoint: issuer
        ? `${issuer}/protocol/openid-connect/token`
        : null,
      localLoginEnabled: this.allowsLocalTokens(),
    };
  }
}
