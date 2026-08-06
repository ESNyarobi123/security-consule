import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IamChangeRequestStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ApprovalsService } from '@pssms/approvals';
import { AuditService } from '@pssms/audit';
import {
  AuthUser,
  PrismaService,
  actorBypassesRoleAssignmentCeiling,
  assertActorMayAssignRoles,
  assertActorMayManagePrivilegedUser,
  describePasswordPolicy,
  evaluatePasswordPolicy,
  normalizePasswordPolicy,
  type ResolvedPasswordPolicy,
} from '@pssms/shared';
import {
  CreateUserDto,
  IamChangeRequestResponseDto,
  LoginHistoryResponseDto,
  PasswordPolicyDto,
  UserAccessResponseDto,
  UserResponseDto,
} from '../presentation/dto/user.dto';

/** External portal accounts use party binding, not staff site ABAC. */
const EXTERNAL_ACL_ROLES = new Set([
  'CUSTOMER_PORTAL',
  'CUSTOMER_EMPLOYEE',
  'SUPPLIER_PORTAL',
  'OTHER_SECURITY_COMPANY',
  'VEHICLE_OWNER',
  'CONTRACTOR',
  'CONSULTANT',
  'SERVICE_PROVIDER',
]);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
  ) {}

  async create(
    dto: CreateUserDto,
    actor: AuthUser,
  ): Promise<UserResponseDto> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: 'Email already registered',
      });
    }

    const policy = await this.resolveOrgPasswordPolicy(actor.organizationId);
    const policyFailures = evaluatePasswordPolicy(dto.password, policy);
    if (policyFailures.length > 0) {
      throw new BadRequestException({
        error: 'WEAK_PASSWORD',
        message: `Password must contain ${policyFailures.join(', ')}`,
      });
    }

    const roles = await this.prisma.role.findMany({
      where: {
        organizationId: actor.organizationId,
        code: { in: dto.roleCodes },
      },
    });
    if (roles.length !== dto.roleCodes.length) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'One or more roles not found',
      });
    }

    assertActorMayAssignRoles(actor, dto.roleCodes);
    if (dto.roleCodes.includes('CUSTOMER_EMPLOYEE')) {
      throw new BadRequestException({
        error: 'CUSTOMER_EMPLOYEE_REQUIRES_CUSTOMER',
        message:
          'CUSTOMER_EMPLOYEE must be created with a customer binding (use customer portal invite / access link flow)',
      });
    }
    if (dto.roleCodes.includes('OTHER_SECURITY_COMPANY')) {
      throw new BadRequestException({
        error: 'OTHER_SECURITY_REQUIRES_PARTNER',
        message:
          'OTHER_SECURITY_COMPANY must be created with a b2bPartnerId binding (seed / partner invite)',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        organizationId: actor.organizationId,
        // M5-H — admin-created accounts must replace the temporary password.
        mustChangePassword: true,
        createdBy: actor.id,
        roles: {
          create: roles.map((r) => ({ roleId: r.id })),
        },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_USER_CREATED',
      resourceType: 'User',
      resourceId: user.id,
      after: {
        email: user.email,
        roles: dto.roleCodes,
        mustChangePassword: true,
      },
    });

    return this.toDto(user);
  }

  async list(organizationId: string): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.toDto(u));
  }

  /** M5-B — org-scoped login attempts (success + failure). */
  async listLoginHistory(
    actor: AuthUser,
    opts?: { userId?: string; success?: boolean; take?: number },
  ): Promise<LoginHistoryResponseDto[]> {
    if (opts?.userId) {
      await this.requireOrgUser(opts.userId, actor);
    }
    const take = Math.min(Math.max(opts?.take ?? 50, 1), 200);
    const rows = await this.prisma.loginHistory.findMany({
      where: {
        user: { organizationId: actor.organizationId },
        ...(opts?.userId ? { userId: opts.userId } : {}),
        ...(opts?.success === undefined ? {} : { success: opts.success }),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { email: true, fullName: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.user.email,
      fullName: r.user.fullName,
      success: r.success,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt,
    }));
  }

  /** Load an org-scoped user or fail. Prevents cross-tenant management. */
  private async requireOrgUser(userId: string, actor: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user || user.organizationId !== actor.organizationId) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'User not found',
      });
    }
    return user;
  }

  /** M5-K — resolved org password policy (defaults when unset). */
  async getPasswordPolicy(actor: AuthUser): Promise<PasswordPolicyDto> {
    const policy = await this.resolveOrgPasswordPolicy(actor.organizationId);
    return { ...policy, summary: describePasswordPolicy(policy) };
  }

  /**
   * M5-K — SUPER_ADMIN / GENERAL_MANAGER only. Stores overlay JSON on Organization.
   */
  async setPasswordPolicy(
    dto: PasswordPolicyDto,
    actor: AuthUser,
  ): Promise<PasswordPolicyDto> {
    if (!actorBypassesRoleAssignmentCeiling(actor)) {
      throw new ForbiddenException({
        error: 'PASSWORD_POLICY_DENIED',
        message:
          'Only SUPER_ADMIN or GENERAL_MANAGER may change the organization password policy',
      });
    }
    const normalized = normalizePasswordPolicy(dto);
    await this.prisma.organization.update({
      where: { id: actor.organizationId },
      data: {
        passwordPolicy: {
          minLength: normalized.minLength,
          requireUppercase: normalized.requireUppercase,
          requireLowercase: normalized.requireLowercase,
          requireDigit: normalized.requireDigit,
          requireSymbol: normalized.requireSymbol,
        },
      },
    });
    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_PASSWORD_POLICY_UPDATED',
      resourceType: 'Organization',
      resourceId: actor.organizationId,
      after: normalized,
    });
    return { ...normalized, summary: describePasswordPolicy(normalized) };
  }

  async resolveOrgPasswordPolicy(
    organizationId: string,
  ): Promise<ResolvedPasswordPolicy> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { passwordPolicy: true },
    });
    return normalizePasswordPolicy(org?.passwordPolicy);
  }

  /** M5-I — IT/admin sets temporary password; target must change on next login. */
  async resetPassword(
    userId: string,
    password: string,
    actor: AuthUser,
  ): Promise<UserResponseDto> {
    if (userId === actor.id) {
      throw new ForbiddenException({
        error: 'CANNOT_RESET_OWN_PASSWORD',
        message: 'Use POST /auth/change-password for your own password',
      });
    }
    const target = await this.requireOrgUser(userId, actor);
    assertActorMayManagePrivilegedUser(
      actor,
      target.roles.map((r) => r.role.code),
      'reset password for',
    );

    const policy = await this.resolveOrgPasswordPolicy(actor.organizationId);
    const policyFailures = evaluatePasswordPolicy(password, policy);
    if (policyFailures.length > 0) {
      throw new BadRequestException({
        error: 'WEAK_PASSWORD',
        message: `Password must contain ${policyFailures.join(', ')}`,
      });
    }

    const hadMfa = target.mfaEnabled === true;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        // M5-J — password reset also clears MFA so temp login is usable.
        mfaEnabled: false,
        mfaSecret: null,
        mfaVerifiedAt: null,
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_PASSWORD_RESET',
      resourceType: 'User',
      resourceId: userId,
      after: { mustChangePassword: true, mfaCleared: hadMfa },
    });

    return this.toDto(user);
  }

  /** M5-J — IT/admin clears MFA enrollment for another user (no TOTP required). */
  async resetMfa(userId: string, actor: AuthUser): Promise<UserResponseDto> {
    if (userId === actor.id) {
      throw new ForbiddenException({
        error: 'CANNOT_RESET_OWN_MFA',
        message: 'Use POST /auth/mfa/disable for your own MFA',
      });
    }
    const target = await this.requireOrgUser(userId, actor);
    assertActorMayManagePrivilegedUser(
      actor,
      target.roles.map((r) => r.role.code),
      'reset MFA for',
    );

    if (!target.mfaEnabled && !target.mfaSecret) {
      return this.toDto(target);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaVerifiedAt: null,
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_MFA_ADMIN_RESET',
      resourceType: 'User',
      resourceId: userId,
      before: { mfaEnabled: target.mfaEnabled },
      after: { mfaEnabled: false },
    });

    return this.toDto(user);
  }

  async suspend(
    userId: string,
    reason: string | undefined,
    actor: AuthUser,
  ): Promise<UserResponseDto> {
    if (!actorBypassesRoleAssignmentCeiling(actor)) {
      throw new ForbiddenException({
        error: 'USE_SUSPEND_SUBMIT',
        message:
          'Submit a suspend request for GM approval (POST /users/:id/suspend/submit)',
      });
    }
    return this.applySuspend(userId, reason, actor, 'direct');
  }

  /** M5-F — IT/CISO submit suspend → same GM approval matrix as role change. */
  async submitSuspend(
    userId: string,
    reason: string | undefined,
    actor: AuthUser,
  ): Promise<IamChangeRequestResponseDto> {
    if (userId === actor.id) {
      throw new ForbiddenException({
        error: 'CANNOT_SUSPEND_SELF',
        message: 'You cannot suspend your own account',
      });
    }
    const target = await this.requireOrgUser(userId, actor);
    if (!target.isActive) {
      throw new BadRequestException({
        error: 'ALREADY_SUSPENDED',
        message: 'User is already suspended',
      });
    }
    assertActorMayManagePrivilegedUser(
      actor,
      target.roles.map((r) => r.role.code),
      'request suspend for',
    );

    const pending = await this.prisma.iamChangeRequest.findFirst({
      where: {
        organizationId: actor.organizationId,
        targetUserId: userId,
        status: IamChangeRequestStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException({
        error: 'PENDING_IAM_CHANGE',
        message: 'A pending IAM change already exists for this user',
      });
    }

    const request = await this.prisma.iamChangeRequest.create({
      data: {
        organizationId: actor.organizationId,
        targetUserId: userId,
        changeType: 'SUSPEND',
        proposedRoleCodes: [],
        previousRoleCodes: target.roles.map((r) => r.role.code),
        reason: reason?.trim() || null,
        status: IamChangeRequestStatus.PENDING,
        createdBy: actor.id,
      },
    });

    const approval = await this.approvals.start(
      {
        workflowCode: 'iam-role-change-approval',
        resourceType: 'IamChangeRequest',
        resourceId: request.id,
      },
      actor,
    );

    const updated = await this.prisma.iamChangeRequest.update({
      where: { id: request.id },
      data: { approvalInstanceId: approval.id },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_SUSPEND_SUBMITTED',
      resourceType: 'IamChangeRequest',
      resourceId: request.id,
      after: {
        targetUserId: userId,
        reason: reason?.trim() || null,
        approvalInstanceId: approval.id,
      },
    });

    return this.toIamChangeDto(updated, target);
  }

  private async applySuspend(
    userId: string,
    reason: string | undefined,
    actor: AuthUser,
    mode: 'direct' | 'approval',
  ): Promise<UserResponseDto> {
    if (userId === actor.id) {
      throw new ForbiddenException({
        error: 'CANNOT_SUSPEND_SELF',
        message: 'You cannot suspend your own account',
      });
    }
    const target = await this.requireOrgUser(userId, actor);
    assertActorMayManagePrivilegedUser(
      actor,
      target.roles.map((r) => r.role.code),
      'suspend',
    );
    if (!target.isActive) {
      return this.toDto(target);
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        suspendedAt: new Date(),
        suspendedReason: reason ?? null,
      },
      include: { roles: { include: { role: true } } },
    });
    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_USER_SUSPENDED',
      resourceType: 'User',
      resourceId: userId,
      after: { reason: reason ?? null, mode },
    });
    return this.toDto(user);
  }

  async reactivate(userId: string, actor: AuthUser): Promise<UserResponseDto> {
    if (!actorBypassesRoleAssignmentCeiling(actor)) {
      throw new ForbiddenException({
        error: 'USE_REACTIVATE_SUBMIT',
        message:
          'Submit a reactivate request for GM approval (POST /users/:id/reactivate/submit)',
      });
    }
    return this.applyReactivate(userId, actor, 'direct');
  }

  /** M5-G — IT/CISO submit reactivate → same GM approval matrix as suspend. */
  async submitReactivate(
    userId: string,
    reason: string | undefined,
    actor: AuthUser,
  ): Promise<IamChangeRequestResponseDto> {
    const target = await this.requireOrgUser(userId, actor);
    if (target.isActive) {
      throw new BadRequestException({
        error: 'ALREADY_ACTIVE',
        message: 'User is already active',
      });
    }
    assertActorMayManagePrivilegedUser(
      actor,
      target.roles.map((r) => r.role.code),
      'request reactivate for',
    );

    const pending = await this.prisma.iamChangeRequest.findFirst({
      where: {
        organizationId: actor.organizationId,
        targetUserId: userId,
        status: IamChangeRequestStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException({
        error: 'PENDING_IAM_CHANGE',
        message: 'A pending IAM change already exists for this user',
      });
    }

    const request = await this.prisma.iamChangeRequest.create({
      data: {
        organizationId: actor.organizationId,
        targetUserId: userId,
        changeType: 'REACTIVATE',
        proposedRoleCodes: [],
        previousRoleCodes: target.roles.map((r) => r.role.code),
        reason: reason?.trim() || null,
        status: IamChangeRequestStatus.PENDING,
        createdBy: actor.id,
      },
    });

    const approval = await this.approvals.start(
      {
        workflowCode: 'iam-role-change-approval',
        resourceType: 'IamChangeRequest',
        resourceId: request.id,
      },
      actor,
    );

    const updated = await this.prisma.iamChangeRequest.update({
      where: { id: request.id },
      data: { approvalInstanceId: approval.id },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_REACTIVATE_SUBMITTED',
      resourceType: 'IamChangeRequest',
      resourceId: request.id,
      after: {
        targetUserId: userId,
        reason: reason?.trim() || null,
        approvalInstanceId: approval.id,
      },
    });

    return this.toIamChangeDto(updated, target);
  }

  private async applyReactivate(
    userId: string,
    actor: AuthUser,
    mode: 'direct' | 'approval',
  ): Promise<UserResponseDto> {
    const target = await this.requireOrgUser(userId, actor);
    assertActorMayManagePrivilegedUser(
      actor,
      target.roles.map((r) => r.role.code),
      'reactivate',
    );
    if (target.isActive) {
      return this.toDto(target);
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true, suspendedAt: null, suspendedReason: null },
      include: { roles: { include: { role: true } } },
    });
    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_USER_REACTIVATED',
      resourceType: 'User',
      resourceId: userId,
      after: { mode },
    });
    return this.toDto(user);
  }

  /** M5-D — read staff site/branch ACL + org catalog for picker. */
  async getAccess(
    userId: string,
    actor: AuthUser,
  ): Promise<UserAccessResponseDto> {
    const target = await this.requireOrgUser(userId, actor);
    this.assertStaffAclTarget(target);
    assertActorMayManagePrivilegedUser(
      actor,
      target.roles.map((r) => r.role.code),
      'view access for',
    );
    return this.buildAccessResponse(target.id, actor.organizationId);
  }

  /** M5-D — replace UserBranchAccess + UserSiteAccess (A7 expands at login). */
  async setAccess(
    userId: string,
    branchIds: string[],
    siteIds: string[],
    actor: AuthUser,
  ): Promise<UserAccessResponseDto> {
    const target = await this.requireOrgUser(userId, actor);
    this.assertStaffAclTarget(target);
    assertActorMayManagePrivilegedUser(
      actor,
      target.roles.map((r) => r.role.code),
      'set access',
    );

    const uniqueBranches = [...new Set(branchIds)];
    const uniqueSites = [...new Set(siteIds)];

    if (uniqueBranches.length > 0) {
      const branches = await this.prisma.branch.findMany({
        where: {
          organizationId: actor.organizationId,
          id: { in: uniqueBranches },
        },
        select: { id: true },
      });
      if (branches.length !== uniqueBranches.length) {
        throw new BadRequestException({
          error: 'INVALID_BRANCH_IDS',
          message: 'One or more branches are not in this organization',
        });
      }
    }
    if (uniqueSites.length > 0) {
      const sites = await this.prisma.site.findMany({
        where: {
          organizationId: actor.organizationId,
          id: { in: uniqueSites },
        },
        select: { id: true },
      });
      if (sites.length !== uniqueSites.length) {
        throw new BadRequestException({
          error: 'INVALID_SITE_IDS',
          message: 'One or more sites are not in this organization',
        });
      }
    }

    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        branchAccess: { select: { branchId: true } },
        siteAccess: { select: { siteId: true } },
      },
    });
    const beforeBranches = (before?.branchAccess ?? []).map((b) => b.branchId);
    const beforeSites = (before?.siteAccess ?? []).map((s) => s.siteId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userBranchAccess.deleteMany({ where: { userId } });
      await tx.userSiteAccess.deleteMany({ where: { userId } });
      if (uniqueBranches.length > 0) {
        await tx.userBranchAccess.createMany({
          data: uniqueBranches.map((branchId) => ({ userId, branchId })),
        });
      }
      if (uniqueSites.length > 0) {
        await tx.userSiteAccess.createMany({
          data: uniqueSites.map((siteId) => ({ userId, siteId })),
        });
      }
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_USER_ACCESS_CHANGED',
      resourceType: 'User',
      resourceId: userId,
      before: { branchIds: beforeBranches, siteIds: beforeSites },
      after: { branchIds: uniqueBranches, siteIds: uniqueSites },
    });

    return this.buildAccessResponse(userId, actor.organizationId);
  }

  private assertStaffAclTarget(target: {
    customerId?: string | null;
    supplierId?: string | null;
    b2bPartnerId?: string | null;
    roles: Array<{ role: { code: string } }>;
  }) {
    if (target.customerId || target.supplierId || target.b2bPartnerId) {
      throw new BadRequestException({
        error: 'EXTERNAL_USER_ACL',
        message:
          'Site/branch ACL applies to internal staff only — external accounts use party binding',
      });
    }
    const codes = target.roles.map((r) => r.role.code);
    if (codes.some((c) => EXTERNAL_ACL_ROLES.has(c))) {
      throw new BadRequestException({
        error: 'EXTERNAL_USER_ACL',
        message:
          'Site/branch ACL applies to internal staff only — external accounts use party binding',
      });
    }
  }

  private async buildAccessResponse(
    userId: string,
    organizationId: string,
  ): Promise<UserAccessResponseDto> {
    const [access, catalogBranches, catalogSites] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          branchAccess: { select: { branchId: true } },
          siteAccess: { select: { siteId: true } },
        },
      }),
      this.prisma.branch.findMany({
        where: { organizationId },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.site.findMany({
        where: { organizationId },
        select: { id: true, code: true, name: true, branchId: true },
        orderBy: { code: 'asc' },
      }),
    ]);
    const branchIds = (access?.branchAccess ?? []).map((b) => b.branchId);
    const siteIds = (access?.siteAccess ?? []).map((s) => s.siteId);
    const branchMap = new Map(catalogBranches.map((b) => [b.id, b]));
    const siteMap = new Map(catalogSites.map((s) => [s.id, s]));
    return {
      userId,
      branchIds,
      siteIds,
      branches: branchIds
        .map((id) => branchMap.get(id))
        .filter((b): b is NonNullable<typeof b> => !!b),
      sites: siteIds
        .map((id) => siteMap.get(id))
        .filter((s): s is NonNullable<typeof s> => !!s),
      catalog: {
        branches: catalogBranches,
        sites: catalogSites,
      },
    };
  }

  async setRoles(
    userId: string,
    roleCodes: string[],
    actor: AuthUser,
  ): Promise<UserResponseDto> {
    if (!actorBypassesRoleAssignmentCeiling(actor)) {
      throw new ForbiddenException({
        error: 'USE_ROLE_CHANGE_SUBMIT',
        message:
          'Submit a role-change request for GM approval (POST /users/:id/roles/submit)',
      });
    }
    return this.applyRoleCodes(userId, roleCodes, actor, 'direct');
  }

  /** M5-E — IT/CISO submit role change → iam-role-change-approval (GM). */
  async submitRoleChange(
    userId: string,
    roleCodes: string[],
    actor: AuthUser,
  ): Promise<IamChangeRequestResponseDto> {
    const unique = [...new Set(roleCodes)];
    if (unique.length === 0) {
      throw new BadRequestException({
        error: 'ROLES_REQUIRED',
        message: 'Select at least one role',
      });
    }
    const target = await this.requireOrgUser(userId, actor);
    this.assertStaffAclTarget(target);
    assertActorMayManagePrivilegedUser(
      actor,
      target.roles.map((r) => r.role.code),
      'request role change for',
    );
    const before = target.roles.map((r) => r.role.code);
    assertActorMayAssignRoles(actor, unique, {
      targetUserId: userId,
      targetCurrentRoleCodes: before,
    });
    await this.validateRoleCodesForTarget(unique, target, actor.organizationId);

    const pending = await this.prisma.iamChangeRequest.findFirst({
      where: {
        organizationId: actor.organizationId,
        targetUserId: userId,
        status: IamChangeRequestStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException({
        error: 'PENDING_IAM_CHANGE',
        message: 'A pending IAM change already exists for this user',
      });
    }

    const request = await this.prisma.iamChangeRequest.create({
      data: {
        organizationId: actor.organizationId,
        targetUserId: userId,
        changeType: 'ROLE_ASSIGNMENT',
        proposedRoleCodes: unique,
        previousRoleCodes: before,
        status: IamChangeRequestStatus.PENDING,
        createdBy: actor.id,
      },
    });

    const approval = await this.approvals.start(
      {
        workflowCode: 'iam-role-change-approval',
        resourceType: 'IamChangeRequest',
        resourceId: request.id,
      },
      actor,
    );

    const updated = await this.prisma.iamChangeRequest.update({
      where: { id: request.id },
      data: { approvalInstanceId: approval.id },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_ROLE_CHANGE_SUBMITTED',
      resourceType: 'IamChangeRequest',
      resourceId: request.id,
      after: {
        targetUserId: userId,
        proposedRoleCodes: unique,
        previousRoleCodes: before,
        approvalInstanceId: approval.id,
      },
    });

    return this.toIamChangeDto(updated, target);
  }

  async listRoleChangeRequests(
    actor: AuthUser,
    status?: string,
  ): Promise<IamChangeRequestResponseDto[]> {
    const statusFilter =
      status &&
      Object.values(IamChangeRequestStatus).includes(
        status as IamChangeRequestStatus,
      )
        ? (status as IamChangeRequestStatus)
        : undefined;
    const rows = await this.prisma.iamChangeRequest.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const userIds = [...new Set(rows.map((r) => r.targetUserId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, organizationId: actor.organizationId },
      select: { id: true, email: true, fullName: true },
    });
    const map = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const u = map.get(r.targetUserId);
      return this.toIamChangeDto(r, u);
    });
  }

  async approveRoleChange(
    requestId: string,
    actor: AuthUser,
  ): Promise<IamChangeRequestResponseDto> {
    const request = await this.requirePendingIamChange(requestId, actor);
    if (!request.approvalInstanceId) {
      throw new BadRequestException({
        error: 'NO_APPROVAL_INSTANCE',
        message: 'Role-change request has no approval instance',
      });
    }

    const approval = await this.approvals.act(
      request.approvalInstanceId,
      { decision: 'APPROVE' },
      actor,
    );

    if (approval.status !== 'APPROVED') {
      return this.toIamChangeDto(request);
    }

    return this.finalizeApprovedRoleChange(request.id, actor);
  }

  /**
   * Apply roles when approval matrix completes (domain approve or generic
   * approvals.act terminal sync). Idempotent if already APPROVED.
   */
  async finalizeApprovedRoleChange(
    requestId: string,
    actor: AuthUser,
  ): Promise<IamChangeRequestResponseDto> {
    const request = await this.prisma.iamChangeRequest.findFirst({
      where: { id: requestId, organizationId: actor.organizationId },
    });
    if (!request) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Role-change request not found',
      });
    }
    if (request.status === IamChangeRequestStatus.APPROVED) {
      const target = await this.prisma.user.findUnique({
        where: { id: request.targetUserId },
        select: { email: true, fullName: true },
      });
      return this.toIamChangeDto(request, target ?? undefined);
    }
    if (request.status === IamChangeRequestStatus.CANCELLED) {
      return this.toIamChangeDto(request);
    }
    if (request.status !== IamChangeRequestStatus.PENDING) {
      throw new BadRequestException({
        error: 'NOT_PENDING',
        message: 'Role-change request is not pending',
      });
    }

    // Terminal sync usually applied SUSPEND/REACTIVATE via approvals.act;
    // keep a domain fallback so empty proposedRoleCodes never wipe roles.
    if (request.changeType === 'SUSPEND') {
      const target = await this.prisma.user.findFirst({
        where: {
          id: request.targetUserId,
          organizationId: actor.organizationId,
        },
        select: { id: true, isActive: true },
      });
      if (!target || !target.isActive) {
        await this.prisma.iamChangeRequest.update({
          where: { id: request.id },
          data: {
            status: IamChangeRequestStatus.CANCELLED,
            decidedBy: actor.id,
            decidedAt: new Date(),
            rejectReason:
              'STALE_SUSPEND — user already inactive or missing at approve',
          },
        });
        await this.audit.record({
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: 'IDENTITY_SUSPEND_STALE',
          resourceType: 'IamChangeRequest',
          resourceId: request.id,
        });
        throw new ConflictException({
          error: 'STALE_SUSPEND',
          message:
            'User already inactive — suspend request cancelled; submit again if needed',
        });
      }
      await this.applySuspend(
        request.targetUserId,
        request.reason ?? undefined,
        actor,
        'approval',
      );
      const updatedSuspend = await this.prisma.iamChangeRequest.update({
        where: { id: request.id },
        data: {
          status: IamChangeRequestStatus.APPROVED,
          decidedBy: actor.id,
          decidedAt: new Date(),
        },
      });
      await this.audit.record({
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: 'IDENTITY_SUSPEND_APPROVED',
        resourceType: 'IamChangeRequest',
        resourceId: request.id,
        after: { targetUserId: request.targetUserId, reason: request.reason },
      });
      const suspendTarget = await this.prisma.user.findUnique({
        where: { id: request.targetUserId },
        select: { email: true, fullName: true },
      });
      return this.toIamChangeDto(updatedSuspend, suspendTarget ?? undefined);
    }

    if (request.changeType === 'REACTIVATE') {
      const target = await this.prisma.user.findFirst({
        where: {
          id: request.targetUserId,
          organizationId: actor.organizationId,
        },
        select: { id: true, isActive: true },
      });
      if (!target || target.isActive) {
        await this.prisma.iamChangeRequest.update({
          where: { id: request.id },
          data: {
            status: IamChangeRequestStatus.CANCELLED,
            decidedBy: actor.id,
            decidedAt: new Date(),
            rejectReason:
              'STALE_REACTIVATE — user already active or missing at approve',
          },
        });
        await this.audit.record({
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: 'IDENTITY_REACTIVATE_STALE',
          resourceType: 'IamChangeRequest',
          resourceId: request.id,
        });
        throw new ConflictException({
          error: 'STALE_REACTIVATE',
          message:
            'User already active — reactivate request cancelled; submit again if needed',
        });
      }
      await this.applyReactivate(request.targetUserId, actor, 'approval');
      const updatedReactivate = await this.prisma.iamChangeRequest.update({
        where: { id: request.id },
        data: {
          status: IamChangeRequestStatus.APPROVED,
          decidedBy: actor.id,
          decidedAt: new Date(),
        },
      });
      await this.audit.record({
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: 'IDENTITY_REACTIVATE_APPROVED',
        resourceType: 'IamChangeRequest',
        resourceId: request.id,
        after: { targetUserId: request.targetUserId },
      });
      const reactivateTarget = await this.prisma.user.findUnique({
        where: { id: request.targetUserId },
        select: { email: true, fullName: true },
      });
      return this.toIamChangeDto(
        updatedReactivate,
        reactivateTarget ?? undefined,
      );
    }

    const live = await this.prisma.userRole.findMany({
      where: { userId: request.targetUserId },
      include: { role: { select: { code: true } } },
    });
    const liveCodes = live.map((r) => r.role.code).sort();
    const expected = [...request.previousRoleCodes].sort();
    if (
      liveCodes.length !== expected.length ||
      liveCodes.some((c, i) => c !== expected[i])
    ) {
      await this.prisma.iamChangeRequest.update({
        where: { id: request.id },
        data: {
          status: IamChangeRequestStatus.CANCELLED,
          decidedBy: actor.id,
          decidedAt: new Date(),
          rejectReason:
            'STALE_ROLE_CHANGE — live roles no longer match snapshot at submit',
        },
      });
      await this.audit.record({
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: 'IDENTITY_ROLE_CHANGE_STALE',
        resourceType: 'IamChangeRequest',
        resourceId: request.id,
        after: { liveCodes, previousRoleCodes: request.previousRoleCodes },
      });
      throw new ConflictException({
        error: 'STALE_ROLE_CHANGE',
        message:
          'Live roles changed since submit — request cancelled; submit again',
      });
    }

    await this.applyRoleCodes(
      request.targetUserId,
      request.proposedRoleCodes,
      actor,
      'approval',
    );

    const updated = await this.prisma.iamChangeRequest.update({
      where: { id: request.id },
      data: {
        status: IamChangeRequestStatus.APPROVED,
        decidedBy: actor.id,
        decidedAt: new Date(),
      },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_ROLE_CHANGE_APPROVED',
      resourceType: 'IamChangeRequest',
      resourceId: request.id,
      after: {
        targetUserId: request.targetUserId,
        proposedRoleCodes: request.proposedRoleCodes,
      },
    });

    const target = await this.prisma.user.findUnique({
      where: { id: request.targetUserId },
      select: { email: true, fullName: true },
    });
    return this.toIamChangeDto(updated, target ?? undefined);
  }

  async rejectRoleChange(
    requestId: string,
    reason: string | undefined,
    actor: AuthUser,
  ): Promise<IamChangeRequestResponseDto> {
    const request = await this.requirePendingIamChange(requestId, actor);
    if (request.approvalInstanceId) {
      await this.approvals.act(
        request.approvalInstanceId,
        {
          decision: 'REJECT',
          remarks: reason?.trim() || 'Rejected',
        },
        actor,
      );
    }
    return this.finalizeRejectedRoleChange(requestId, reason, actor);
  }

  async finalizeRejectedRoleChange(
    requestId: string,
    reason: string | undefined,
    actor: AuthUser,
  ): Promise<IamChangeRequestResponseDto> {
    const request = await this.prisma.iamChangeRequest.findFirst({
      where: { id: requestId, organizationId: actor.organizationId },
    });
    if (!request) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Role-change request not found',
      });
    }
    if (request.status === IamChangeRequestStatus.REJECTED) {
      return this.toIamChangeDto(request);
    }
    if (request.status !== IamChangeRequestStatus.PENDING) {
      throw new BadRequestException({
        error: 'NOT_PENDING',
        message: 'Role-change request is not pending',
      });
    }

    const updated = await this.prisma.iamChangeRequest.update({
      where: { id: request.id },
      data: {
        status: IamChangeRequestStatus.REJECTED,
        decidedBy: actor.id,
        decidedAt: new Date(),
        rejectReason: reason?.trim() || 'Rejected',
      },
    });

    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_ROLE_CHANGE_REJECTED',
      resourceType: 'IamChangeRequest',
      resourceId: request.id,
      after: { rejectReason: updated.rejectReason },
    });

    return this.toIamChangeDto(updated);
  }

  private async requirePendingIamChange(requestId: string, actor: AuthUser) {
    const request = await this.prisma.iamChangeRequest.findFirst({
      where: { id: requestId, organizationId: actor.organizationId },
    });
    if (!request) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Role-change request not found',
      });
    }
    if (request.status !== IamChangeRequestStatus.PENDING) {
      throw new BadRequestException({
        error: 'NOT_PENDING',
        message: 'Role-change request is not pending',
      });
    }
    return request;
  }

  private async validateRoleCodesForTarget(
    roleCodes: string[],
    target: {
      customerId?: string | null;
      b2bPartnerId?: string | null;
    },
    organizationId: string,
  ) {
    const roles = await this.prisma.role.findMany({
      where: { organizationId, code: { in: roleCodes } },
    });
    if (roles.length !== roleCodes.length) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'One or more roles not found',
      });
    }
    if (roleCodes.includes('CUSTOMER_EMPLOYEE') && !target.customerId) {
      throw new BadRequestException({
        error: 'CUSTOMER_EMPLOYEE_REQUIRES_CUSTOMER',
        message:
          'Cannot assign CUSTOMER_EMPLOYEE without linking the user to a customer',
      });
    }
    if (roleCodes.includes('OTHER_SECURITY_COMPANY') && !target.b2bPartnerId) {
      throw new BadRequestException({
        error: 'OTHER_SECURITY_REQUIRES_PARTNER',
        message:
          'Cannot assign OTHER_SECURITY_COMPANY without linking the user to a B2B partner',
      });
    }
  }

  private async applyRoleCodes(
    userId: string,
    roleCodes: string[],
    actor: AuthUser,
    mode: 'direct' | 'approval',
  ): Promise<UserResponseDto> {
    const target = await this.requireOrgUser(userId, actor);
    const unique = [...new Set(roleCodes)];
    const roles = await this.prisma.role.findMany({
      where: { organizationId: actor.organizationId, code: { in: unique } },
    });
    if (roles.length !== unique.length) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'One or more roles not found',
      });
    }
    const before = target.roles.map((r) => r.role.code);
    assertActorMayAssignRoles(actor, unique, {
      targetUserId: userId,
      targetCurrentRoleCodes: before,
    });
    await this.validateRoleCodesForTarget(unique, target, actor.organizationId);
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roles.map((r) => ({ userId, roleId: r.id })),
      }),
    ]);
    await this.audit.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'IDENTITY_USER_ROLES_CHANGED',
      resourceType: 'User',
      resourceId: userId,
      before: { roles: before },
      after: { roles: unique, mode },
    });
    const updated = await this.requireOrgUser(userId, actor);
    return this.toDto(updated);
  }

  private toIamChangeDto(
    row: {
      id: string;
      targetUserId: string;
      changeType: string;
      proposedRoleCodes: string[];
      previousRoleCodes: string[];
      reason?: string | null;
      status: IamChangeRequestStatus;
      approvalInstanceId?: string | null;
      createdBy: string;
      decidedBy?: string | null;
      decidedAt?: Date | null;
      rejectReason?: string | null;
      createdAt: Date;
    },
    target?: { email?: string; fullName?: string } | null,
  ): IamChangeRequestResponseDto {
    return {
      id: row.id,
      targetUserId: row.targetUserId,
      targetEmail: target?.email,
      targetFullName: target?.fullName,
      changeType: row.changeType,
      proposedRoleCodes: row.proposedRoleCodes,
      previousRoleCodes: row.previousRoleCodes,
      reason: row.reason ?? null,
      status: row.status,
      approvalInstanceId: row.approvalInstanceId ?? null,
      createdBy: row.createdBy,
      decidedBy: row.decidedBy ?? null,
      decidedAt: row.decidedAt ?? null,
      rejectReason: row.rejectReason ?? null,
      createdAt: row.createdAt,
    };
  }

  private toDto(user: {
    id: string;
    email: string;
    fullName: string;
    phone?: string | null;
    organizationId: string;
    isActive: boolean;
    mustChangePassword?: boolean;
    mfaEnabled?: boolean;
    lastLoginAt?: Date | null;
    suspendedAt?: Date | null;
    suspendedReason?: string | null;
    createdAt: Date;
    roles: Array<{ role: { code: string } }>;
  }): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone ?? null,
      organizationId: user.organizationId,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword === true,
      mfaEnabled: user.mfaEnabled === true,
      lastLoginAt: user.lastLoginAt ?? null,
      suspendedAt: user.suspendedAt ?? null,
      suspendedReason: user.suspendedReason ?? null,
      roles: user.roles.map((r) => r.role.code),
      createdAt: user.createdAt,
    };
  }
}
