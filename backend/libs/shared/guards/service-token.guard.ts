import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      serviceUser?: AuthUser;
    }>();
    const auth = request.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const expected = process.env.INTEGRATION_SERVICE_TOKEN ?? 'dev_integration_token';
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid service token');
    }
    request.serviceUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'integration@system.pssms',
      organizationId: '',
      fullName: 'Integration System',
      roles: ['SYSTEM'],
      permissions: [],
      allowedBranchIds: [],
      allowedSiteIds: [],
    };
    return true;
  }
}
