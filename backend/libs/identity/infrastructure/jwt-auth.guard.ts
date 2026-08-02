import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '@pssms/shared';

/**
 * Public routes stay open without a token. If a Bearer token is present,
 * still authenticate so handlers receive `@CurrentUser()` (e.g. public
 * visitor appointment create records `createdBy` for SoD on approve).
 * Invalid/expired tokens on public routes fall back to anonymous access.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      const req = context.switchToHttp().getRequest<{
        headers?: { authorization?: string };
      }>();
      const auth = req.headers?.authorization ?? '';
      if (!auth.startsWith('Bearer ')) {
        return true;
      }
      try {
        const ok = await super.canActivate(context);
        return ok as boolean;
      } catch {
        return true;
      }
    }
    return (await super.canActivate(context)) as boolean;
  }
}
