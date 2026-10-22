import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser, PrismaService } from '@pssms/shared';
import { AuditService } from '@pssms/audit';

export type SelfEmployeeContext = 'ESS' | 'PAYROLL';

/**
 * Resolves the workforce Employee row that belongs to the signed-in user.
 *
 * Self-service must not depend on an administrator manually linking the
 * account, so resolution falls back to:
 *   1. Employee.userId (explicit link)
 *   2. GuardProfile.userId → Employee.guardProfileId
 *   3. Employee.email == login email (only when still unlinked)
 *
 * A successful fallback binds Employee.userId so later calls are direct, and
 * writes an audit row so the automatic link is traceable.
 */
@Injectable()
export class SelfEmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async resolve(user: AuthUser, context: SelfEmployeeContext = 'ESS') {
    const organizationId = user.organizationId;

    const direct = await this.prisma.employee.findMany({
      where: { organizationId, userId: user.id },
      take: 2,
    });
    if (direct.length > 1) throw this.ambiguous(context);
    if (direct.length === 1) return direct[0];

    const guard = await this.prisma.guardProfile.findFirst({
      where: { organizationId, userId: user.id },
      select: { id: true },
    });
    if (guard) {
      const byGuard = await this.prisma.employee.findFirst({
        where: { organizationId, guardProfileId: guard.id },
      });
      if (byGuard) {
        if (!byGuard.userId) return this.bind(byGuard, user, context, 'guard_profile');
        return byGuard;
      }
    }

    if (user.email) {
      const byEmail = await this.prisma.employee.findMany({
        where: {
          organizationId,
          userId: null,
          email: { equals: user.email, mode: 'insensitive' },
        },
        take: 2,
      });
      if (byEmail.length > 1) throw this.ambiguous(context);
      if (byEmail.length === 1) {
        return this.bind(byEmail[0], user, context, 'email');
      }
    }

    throw new NotFoundException({
      error: context === 'ESS' ? 'ESS_PROFILE_MISSING' : 'PAYROLL_PROFILE_MISSING',
      message:
        context === 'ESS'
          ? 'No employee profile is linked to this user. Ask HR to add your email on your employee profile.'
          : 'No employee profile is linked to this login, so there are no payslips to show. Ask HR to add your email on your employee profile.',
    });
  }

  private ambiguous(context: SelfEmployeeContext) {
    return new NotFoundException({
      error:
        context === 'ESS' ? 'ESS_PROFILE_AMBIGUOUS' : 'PAYROLL_PROFILE_AMBIGUOUS',
      message:
        'Multiple employee profiles match this user. Ask HR to fix the link.',
    });
  }

  private async bind(
    employee: { id: string },
    user: AuthUser,
    context: SelfEmployeeContext,
    reason: 'guard_profile' | 'email',
  ) {
    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: { userId: user.id },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `${context.toLowerCase()}.profile.auto_linked`,
      resourceType: 'Employee',
      resourceId: employee.id,
      after: { reason, userId: user.id },
    });
    return updated;
  }
}
