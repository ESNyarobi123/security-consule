import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser, PrismaService } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { nextEmployeeNumber } from './employee-number.util';

/**
 * External party accounts are bound to a customer / supplier / partner record,
 * never to the company payroll. They must never be provisioned an Employee.
 */
const EXTERNAL_ACCOUNT_ROLES = new Set([
  'CUSTOMER_PORTAL',
  'CUSTOMER_EMPLOYEE',
  'SUPPLIER_PORTAL',
  'VEHICLE_OWNER',
  'OTHER_SECURITY_COMPANY',
  'CONTRACTOR',
  'CONSULTANT',
  'SERVICE_PROVIDER',
  'APPLICANT',
]);

export type SelfEmployeeContext = 'ESS' | 'PAYROLL';

/**
 * Resolves the workforce Employee row that belongs to the signed-in user.
 *
 * Self-service must not depend on an administrator manually linking the
 * account, so resolution falls back to:
 *   1. Employee.userId (explicit link)
 *   2. GuardProfile.userId → Employee.guardProfileId
 *   3. Employee.email == login email (only when still unlinked)
 *   4. Provision an Employee row for an internal staff login that has none
 *
 * A successful fallback binds Employee.userId so later calls are direct, and
 * writes an audit row so the automatic link is traceable. Provisioning is
 * limited to internal staff: external party accounts (customer, supplier,
 * vehicle owner, contractor, consultant, service provider, B2B partner) never
 * get a company payroll profile — they keep the "no profile" response.
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

    if (this.isInternalStaff(user)) {
      const provisioned = await this.provision(user, context);
      if (provisioned) return provisioned;
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

  /**
   * Internal staff only. Any external party binding (customer, supplier, B2B
   * partner) or external role disqualifies the account — those users must never
   * appear on the company payroll register.
   */
  private isInternalStaff(user: AuthUser): boolean {
    if (user.customerId || user.supplierId || user.b2bPartnerId) return false;
    if (!user.email) return false;
    return !(user.roles ?? []).some((role) => EXTERNAL_ACCOUNT_ROLES.has(role));
  }

  /**
   * Creates the missing Employee row for an internal staff login so payroll and
   * ESS self-service cannot dead-end on "no profile linked".
   *
   * Only identity data is copied (name, email, branch). Salary terms, bank
   * details and department stay empty for HR/Payroll to configure — we never
   * invent pay figures.
   */
  private async provision(user: AuthUser, context: SelfEmployeeContext) {
    const alreadyLinked = await this.prisma.employee.findFirst({
      where: { organizationId: user.organizationId, userId: user.id },
    });
    if (alreadyLinked) return alreadyLinked;

    const branchId = await this.resolveProvisionBranch(user);
    const employeeNumber = await nextEmployeeNumber(
      this.prisma,
      user.organizationId,
      'EMP-',
    );

    let created;
    try {
      created = await this.prisma.employee.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          employeeNumber,
          fullName: user.fullName || user.email,
          email: user.email,
          branchId,
          employmentType: 'ADMIN',
          status: 'ACTIVE',
          hireDate: new Date(),
          createdBy: user.id,
        },
      });
    } catch {
      // Concurrent first access (or a number race): reuse whatever now exists.
      const raced = await this.prisma.employee.findFirst({
        where: { organizationId: user.organizationId, userId: user.id },
      });
      if (raced) return raced;
      throw new Error(
        `Could not provision a staff profile for ${user.email} — ask HR to create the employee record`,
      );
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `${context.toLowerCase()}.profile.provisioned`,
      resourceType: 'Employee',
      resourceId: created.id,
      after: {
        reason: 'iam_staff_self_service',
        userId: user.id,
        employeeNumber: created.employeeNumber,
        branchId,
      },
    });

    return created;
  }

  private async resolveProvisionBranch(user: AuthUser): Promise<string | null> {
    const branchIds = user.allowedBranchIds ?? [];
    if (branchIds.length !== 1) return null;
    const branch = await this.prisma.branch.findFirst({
      where: { organizationId: user.organizationId, id: branchIds[0] },
      select: { id: true },
    });
    return branch?.id ?? null;
  }
}
