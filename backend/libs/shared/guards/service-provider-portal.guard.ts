import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../types/auth-user';
import { isServiceProviderSelfScoped } from '../utils/service-provider-scope.util';

/**
 * SERVICE_PROVIDER / providers.self — Portal 35.10 service-provider lane.
 */
const ALLOWED_GET_EXACT = [
  '/api/v1/auth/me',
  '/api/v1/visitors/me',
  '/api/v1/visitors/me/appointments',
  '/api/v1/visitors/me/entries',
];

const ALLOWED_POST_EXACT = ['/api/v1/auth/change-password'];

@Injectable()
export class ServiceProviderPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: AuthUser;
    }>();
    const user = req.user;
    if (!user || !isServiceProviderSelfScoped(user)) return true;

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
      error: 'SERVICE_PROVIDER_PATH_DENIED',
      message: 'Path not allowed for service-provider portal',
    });
  }
}
