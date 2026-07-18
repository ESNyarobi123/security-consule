import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * SUPPLIER_PORTAL users (JWT supplierId set) are read-only on an allowlisted
 * API surface — mirror of CustomerPortalGuard.
 */
const ALLOWED_GET_PREFIXES = [
  '/api/v1/procurement/suppliers/me',
  '/api/v1/auth/me',
];

const ALLOWED_GET_EXACT = ['/api/v1/procurement/purchase-orders'];

@Injectable()
export class SupplierPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: AuthUser;
    }>();
    const user = req.user;
    if (!user?.supplierId) return true;

    const method = (req.method ?? 'GET').toUpperCase();
    const path = (req.url ?? '').split('?')[0];

    if (method === 'OPTIONS' || method === 'HEAD') return true;

    if (method !== 'GET') {
      throw new ForbiddenException({
        error: 'SUPPLIER_PORTAL_READ_ONLY',
        message: 'Supplier portal users cannot mutate resources',
      });
    }

    const allowed =
      ALLOWED_GET_EXACT.includes(path) ||
      ALLOWED_GET_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      );
    if (!allowed) {
      throw new ForbiddenException({
        error: 'SUPPLIER_PORTAL_PATH_DENIED',
        message: 'Path not allowed for supplier portal',
      });
    }

    return true;
  }
}
