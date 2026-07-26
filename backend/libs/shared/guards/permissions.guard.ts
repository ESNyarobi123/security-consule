import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRED_ANY_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';
import { AuthUser } from '../types/auth-user';

/**
 * RBAC permission gate — SUPER_ADMIN bypass.
 * - `@RequirePermissions` → user must have every code (AND)
 * - `@RequireAnyPermissions` → user must have at least one code (OR)
 * Both may be set; both must pass.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAll = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAny = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredAll?.length && !requiredAny?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }
    if (user.roles.includes('SUPER_ADMIN')) return true;

    if (requiredAll?.length) {
      const missing = requiredAll.filter(
        (code) => !user.permissions.includes(code),
      );
      if (missing.length > 0) {
        throw new ForbiddenException(
          `Missing permission(s): ${missing.join(', ')}`,
        );
      }
    }

    if (requiredAny?.length) {
      const ok = requiredAny.some((code) => user.permissions.includes(code));
      if (!ok) {
        throw new ForbiddenException(
          `Missing one of permission(s): ${requiredAny.join(', ')}`,
        );
      }
    }

    return true;
  }
}
