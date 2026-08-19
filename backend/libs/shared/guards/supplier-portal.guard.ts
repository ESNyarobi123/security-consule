import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../types/auth-user';
import { assertSupplierPortalHasSupplierId } from '../utils/supplier-scope.util';

/**
 * SUPPLIER_PORTAL users (JWT supplierId set) are limited to an allowlisted
 * API surface — own supplier data only.
 */
const ALLOWED_GET_PREFIXES = [
  '/api/v1/procurement/suppliers/me',
  '/api/v1/auth/me',
  '/api/v1/documents',
];

const ALLOWED_GET_EXACT = ['/api/v1/procurement/purchase-orders'];

const ALLOWED_POST_PATHS = [
  /^\/api\/v1\/auth\/change-password$/,
  /^\/api\/v1\/procurement\/suppliers\/me\/submissions$/,
  /^\/api\/v1\/procurement\/suppliers\/me\/messages$/,
  /^\/api\/v1\/documents\/upload$/,
];

const ALLOWED_PATCH_PATHS = [/^\/api\/v1\/procurement\/suppliers\/me$/];

@Injectable()
export class SupplierPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: AuthUser;
    }>();
    const user = req.user;
    if (!user) return true;

    // A role without its party binding must never fall through to staff APIs.
    assertSupplierPortalHasSupplierId(user);
    if (!user.supplierId) return true;

    const method = (req.method ?? 'GET').toUpperCase();
    const path = (req.url ?? '').split('?')[0];

    if (method === 'OPTIONS' || method === 'HEAD') return true;

    if (method === 'GET') {
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

    if (method === 'POST') {
      if (ALLOWED_POST_PATHS.some((re) => re.test(path))) return true;
      throw new ForbiddenException({
        error: 'SUPPLIER_PORTAL_READ_ONLY',
        message: 'Supplier portal cannot mutate this resource',
      });
    }

    if (method === 'PATCH') {
      if (ALLOWED_PATCH_PATHS.some((re) => re.test(path))) return true;
      throw new ForbiddenException({
        error: 'SUPPLIER_PORTAL_READ_ONLY',
        message: 'Supplier portal cannot mutate this resource',
      });
    }

    throw new ForbiddenException({
      error: 'SUPPLIER_PORTAL_READ_ONLY',
      message: 'Supplier portal users cannot mutate resources',
    });
  }
}
