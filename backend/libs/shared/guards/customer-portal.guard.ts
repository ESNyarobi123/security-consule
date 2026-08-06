import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../types/auth-user';
import {
  assertCustomerEmployeeHasCustomerId,
  isCustomerEmployeeSelfScoped,
} from '../utils/customer-employee-scope.util';

/**
 * CUSTOMER_PORTAL / CUSTOMER_EMPLOYEE users (JWT customerId set) are limited
 * to an allowlisted API surface. Prevents org-wide mutate/list leaks.
 *
 * Portal 35.9 employees get a narrower allowlist than 35.8 admins.
 */
const PORTAL_ALLOWED_GET_PREFIXES = [
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

/** Exact paths only — do not open /customers/me/* ops slices to staff logins. */
const EMPLOYEE_ALLOWED_GET_EXACT = [
  '/api/v1/access/me',
  '/api/v1/access/me/sites',
  '/api/v1/access/entries',
  '/api/v1/customers/me',
  '/api/v1/customers/me/sites',
  '/api/v1/auth/me',
];

/** Exact GET paths (no staff-only subroutes like /contracts/commercial-alerts). */
const PORTAL_ALLOWED_GET_EXACT = ['/api/v1/contracts'];

/** Exact POST paths (regex) allowed for portal hosts. */
const PORTAL_ALLOWED_POST_PATHS = [
  /^\/api\/v1\/visitors\/appointments\/[^/]+\/approve$/,
  /^\/api\/v1\/visitors\/appointments\/[^/]+\/reject$/,
  /^\/api\/v1\/auth\/change-password$/,
  /^\/api\/v1\/customers\/me\/service-requests$/,
  /^\/api\/v1\/customers\/me\/service-requests\/[^/]+\/cancel$/,
  /^\/api\/v1\/customers\/me\/complaints$/,
  /^\/api\/v1\/customers\/me\/complaints\/[^/]+\/cancel$/,
];

const EMPLOYEE_ALLOWED_POST_PATHS = [
  /^\/api\/v1\/auth\/change-password$/,
  /^\/api\/v1\/access\/me\/entries$/,
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
    if (!user) return true;

    // Misconfigured CUSTOMER_EMPLOYEE without customerId must not fall through
    // to the staff (unguarded) API surface.
    assertCustomerEmployeeHasCustomerId(user);

    if (!user.customerId) return true;

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

    const employeeSelf = isCustomerEmployeeSelfScoped(user);
    const postPaths = employeeSelf
      ? EMPLOYEE_ALLOWED_POST_PATHS
      : PORTAL_ALLOWED_POST_PATHS;

    if (method === 'GET') {
      if (employeeSelf) {
        if (!EMPLOYEE_ALLOWED_GET_EXACT.includes(path)) {
          throw new ForbiddenException({
            error: 'CUSTOMER_EMPLOYEE_PATH_DENIED',
            message: 'Path not allowed for customer employee access',
          });
        }
        return true;
      }
      const allowedExact = PORTAL_ALLOWED_GET_EXACT.includes(path);
      const allowedPrefix = PORTAL_ALLOWED_GET_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      );
      if (!allowedExact && !allowedPrefix) {
        throw new ForbiddenException({
          error: 'CUSTOMER_PORTAL_PATH_DENIED',
          message: 'Path not allowed for customer portal',
        });
      }
      return true;
    }

    if (method === 'POST') {
      const allowed = postPaths.some((re) => re.test(path));
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
