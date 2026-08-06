import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../types/auth-user';
import { isVehicleOwnerSelfScoped } from '../utils/vehicle-owner-scope.util';

/**
 * VEHICLE_OWNER / parking.self — Portal external owners/drivers allowlist.
 */
const ALLOWED_GET_EXACT = [
  '/api/v1/auth/me',
  '/api/v1/parking/me',
  '/api/v1/parking/me/permits',
  '/api/v1/parking/me/entries',
];

const ALLOWED_POST_EXACT = ['/api/v1/auth/change-password'];

@Injectable()
export class VehicleOwnerPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: AuthUser;
    }>();
    const user = req.user;
    if (!user || !isVehicleOwnerSelfScoped(user)) return true;

    const method = (req.method ?? 'GET').toUpperCase();
    const path = (req.url ?? '').split('?')[0];

    if (method === 'OPTIONS' || method === 'HEAD') return true;

    if (method === 'GET' && ALLOWED_GET_EXACT.includes(path)) {
      return true;
    }

    if (method === 'POST' && ALLOWED_POST_EXACT.includes(path)) {
      return true;
    }

    throw new ForbiddenException({
      error: 'VEHICLE_OWNER_PATH_DENIED',
      message: 'Path not allowed for vehicle owner portal',
    });
  }
}
