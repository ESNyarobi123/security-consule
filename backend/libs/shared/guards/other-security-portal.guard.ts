import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * OTHER_SECURITY_COMPANY users (JWT b2bPartnerId) — Portal 35.14 allowlist.
 */
const ALLOWED_GET_EXACT = [
  '/api/v1/auth/me',
  '/api/v1/recruitment/b2b/partners/me',
  '/api/v1/recruitment/b2b/requests',
  '/api/v1/recruitment/b2b/request-options',
];

const ALLOWED_GET_PREFIXES = ['/api/v1/recruitment/b2b/requests/'];

const ALLOWED_POST_EXACT = ['/api/v1/recruitment/b2b/requests'];

@Injectable()
export class OtherSecurityPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: AuthUser;
    }>();
    const user = req.user;
    const isOtherSecurity =
      !!user?.roles?.includes('OTHER_SECURITY_COMPANY') || !!user?.b2bPartnerId;
    if (!isOtherSecurity) return true;

    if (user?.roles?.includes('OTHER_SECURITY_COMPANY') && !user.b2bPartnerId) {
      throw new ForbiddenException({
        error: 'B2B_PARTNER_REQUIRED',
        message: 'Other security company users require a partner binding',
      });
    }

    const method = (req.method ?? 'GET').toUpperCase();
    const path = (req.url ?? '').split('?')[0];

    if (method === 'OPTIONS' || method === 'HEAD') return true;

    if (method === 'GET') {
      const ok =
        ALLOWED_GET_EXACT.includes(path) ||
        ALLOWED_GET_PREFIXES.some(
          (prefix) => path === prefix || path.startsWith(prefix),
        );
      if (!ok) {
        throw new ForbiddenException({
          error: 'OTHER_SECURITY_PATH_DENIED',
          message: 'Path not allowed for other security company portal',
        });
      }
      return true;
    }

    if (method === 'POST' && ALLOWED_POST_EXACT.includes(path)) {
      return true;
    }

    throw new ForbiddenException({
      error: 'OTHER_SECURITY_PATH_DENIED',
      message: 'Path not allowed for other security company portal',
    });
  }
}
