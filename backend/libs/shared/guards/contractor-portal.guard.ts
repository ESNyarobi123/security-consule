import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../types/auth-user';
import { isContractorSelfScoped } from '../utils/contractor-scope.util';

/**
 * CONTRACTOR / visitors.self — Portal 35.10 contractor lane allowlist.
 */
const ALLOWED_GET_EXACT = [
  '/api/v1/auth/me',
  '/api/v1/visitors/me',
  '/api/v1/visitors/me/appointments',
  '/api/v1/visitors/me/entries',
];

const ALLOWED_POST_EXACT = [
  '/api/v1/auth/change-password',
  '/api/v1/visitors/me/appointments',
];

@Injectable()
export class ContractorPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: AuthUser;
    }>();
    const user = req.user;
    if (!user || !isContractorSelfScoped(user)) return true;

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
      error: 'CONTRACTOR_PATH_DENIED',
      message: 'Path not allowed for contractor portal',
    });
  }
}
