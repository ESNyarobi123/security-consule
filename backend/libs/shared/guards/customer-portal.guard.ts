import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * CUSTOMER_PORTAL users (JWT customerId set) are limited to an allowlisted
 * API surface. Prevents org-wide mutate/list leaks until finer ABAC lands.
 *
 * Prefer `/customers/me` (and subpaths) over broad `/customers` so future
 * admin-only customer routes are not accidentally opened to portal JWTs.
 *
 * Mutations are deny-by-default; only explicit host actions (visitor
 * approve/reject) and change-password are allowed — still scoped in service.
 */
const ALLOWED_GET_PREFIXES = [
  '/api/v1/customers/me',
  '/api/v1/finance/invoices',
  '/api/v1/visitors/appointments',
  '/api/v1/access/employees',
  '/api/v1/access/entries',
  '/api/v1/parking/vehicles',
  '/api/v1/parking/permits',
  '/api/v1/documents',
  '/api/v1/auth/me',
];

/** Exact GET paths (no staff-only subroutes like /contracts/commercial-alerts). */
const ALLOWED_GET_EXACT = ['/api/v1/contracts'];

/** Exact POST paths (regex) allowed for portal hosts. */
const ALLOWED_POST_PATHS = [
  /^\/api\/v1\/visitors\/appointments\/[^/]+\/approve$/,
  /^\/api\/v1\/visitors\/appointments\/[^/]+\/reject$/,
  /^\/api\/v1\/auth\/change-password$/,
  /^\/api\/v1\/customers\/me\/service-requests$/,
  /^\/api\/v1\/customers\/me\/service-requests\/[^/]+\/cancel$/,
];

@Injectable()
export class CustomerPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: AuthUser;
    }>();
    const user = req.user;
    if (!user?.customerId) return true;

    const method = (req.method ?? 'GET').toUpperCase();
    const path = (req.url ?? '').split('?')[0];

    if (method === 'OPTIONS' || method === 'HEAD') return true;

    // Temporary password must be replaced before normal portal APIs.
    if (user.mustChangePassword) {
      const allowedWhileForced =
        (method === 'GET' && path === '/api/v1/auth/me') ||
        (method === 'POST' && path === '/api/v1/auth/change-password');
      if (!allowedWhileForced) {
        throw new ForbiddenException({
          error: 'MUST_CHANGE_PASSWORD',
          message: 'Replace your temporary password before continuing',
        });
      }
      return true;
    }

    if (method === 'GET') {
      const allowed =
        ALLOWED_GET_EXACT.includes(path) ||
        ALLOWED_GET_PREFIXES.some(
          (prefix) => path === prefix || path.startsWith(`${prefix}/`),
        );
      if (!allowed) {
        throw new ForbiddenException({
          error: 'CUSTOMER_PORTAL_PATH_DENIED',
          message: 'Path not allowed for customer portal',
        });
      }
      return true;
    }

    if (method === 'POST') {
      const allowed = ALLOWED_POST_PATHS.some((re) => re.test(path));
      if (!allowed) {
        throw new ForbiddenException({
          error: 'CUSTOMER_PORTAL_READ_ONLY',
          message: 'Customer portal users cannot mutate this resource',
        });
      }
      return true;
    }

    throw new ForbiddenException({
      error: 'CUSTOMER_PORTAL_READ_ONLY',
      message: 'Customer portal users cannot mutate resources',
    });
  }
}
