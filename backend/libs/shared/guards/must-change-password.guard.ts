import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * M5-H — when JWT claims mustChangePassword, block all APIs except
 * profile read + password change (same allowlist as customer portal force).
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      user?: AuthUser;
    }>();
    const user = req.user;
    if (!user?.mustChangePassword) return true;

    const method = (req.method ?? 'GET').toUpperCase();
    const path = (req.url ?? '').split('?')[0];

    if (method === 'OPTIONS' || method === 'HEAD') return true;

    const allowed =
      (method === 'GET' && path === '/api/v1/auth/me') ||
      (method === 'POST' && path === '/api/v1/auth/change-password');
    if (!allowed) {
      throw new ForbiddenException({
        error: 'MUST_CHANGE_PASSWORD',
        message: 'Replace your temporary password before continuing',
      });
    }
    return true;
  }
}
