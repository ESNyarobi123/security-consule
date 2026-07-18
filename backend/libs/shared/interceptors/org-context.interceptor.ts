import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { lastValueFrom, Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../types/auth-user';

/**
 * Opens a per-request transaction and binds the RLS org context so PostgreSQL
 * Row-Level Security policies filter every query to the caller's tenant.
 *
 *  - Authenticated user request → `app.organization_id = user.organizationId`.
 *  - Service-token request (trusted internal) → `app.rls_bypass = on`.
 *  - No context (public routes, e.g. login) → runs directly, no transaction.
 *
 * Must run OUTSIDE the ResponseInterceptor so the transaction spans the handler.
 */
@Injectable()
export class OrgContextInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      serviceUser?: AuthUser;
    }>();

    const organizationId = req.user?.organizationId;
    const isService = !organizationId && !!req.serviceUser;

    if (!organizationId && !isService) {
      // Public / unauthenticated route — no tenant context to bind.
      return next.handle();
    }

    const run = this.prisma.runInRequestContext(
      { organizationId: organizationId || undefined, bypass: isService },
      () => lastValueFrom(next.handle()),
    );

    return new Observable((subscriber) => {
      run
        .then((value) => {
          subscriber.next(value);
          subscriber.complete();
        })
        .catch((err) => subscriber.error(err));
    });
  }
}
