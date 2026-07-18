import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * CUSTOMER_PORTAL users (JWT customerId set) are read-only on an allowlisted
 * API surface. Prevents org-wide mutate/list leaks until finer ABAC lands.
 */
const ALLOWED_GET_PREFIXES = [
  '/api/v1/customers/me',
  '/api/v1/customers',
  '/api/v1/contracts',
  '/api/v1/finance/invoices',
  '/api/v1/visitors/appointments',
  '/api/v1/access/employees',
  '/api/v1/parking/vehicles',
  '/api/v1/parking/permits',
  '/api/v1/auth/me',
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

    if (method !== 'GET') {
      throw new ForbiddenException({
        error: 'CUSTOMER_PORTAL_READ_ONLY',
        message: 'Customer portal users cannot mutate resources',
      });
    }

    const allowed = ALLOWED_GET_PREFIXES.some(
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
}
