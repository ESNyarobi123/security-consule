import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeploymentStatus,
  EmployeeStatus,
  EmploymentType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService, resolveSiteIdFilter } from '@pssms/shared';
import { nextEmployeeNumber } from './employee-number.util';
import {
  BranchStaffRowDto,
  CreateBranchStaffDto,
  UpdateBranchStaffDto,
} from '../presentation/dto/branch-staff.dto';

const EDITABLE_STATUSES: EmployeeStatus[] = [
  EmployeeStatus.ACTIVE,
  EmployeeStatus.ON_LEAVE,
  EmployeeStatus.SUSPENDED,
];

/**
 * Portal 35.23 / Module 27-A — branch staff management.
 *
 * Branch Managers (branch ACL), Field Officers (site ACL → branch), Regional
 * Managers (org-wide) and Technical / Business Development Managers manage the
 * staff posted to their own branch. HR hire/exit and payroll stay in their own
 * domains; guard duty status stays the Guards console.
 */
@Injectable()
export class BranchStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertStaff(user: AuthUser): void {
    if (user.customerId || user.supplierId) {
      throw new ForbiddenException({
        error: 'BRANCH_STAFF_ONLY',
        message: 'Branch Operations is staff-only',
      });
    }
  }

  /** `null` = every branch in the org; otherwise the caller's branch allowlist. */
  private async scopedBranchIds(user: AuthUser): Promise<string[] | null> {
    const siteFilter = resolveSiteIdFilter(user);
    if (siteFilter === null) return null;
    if (user.allowedBranchIds.length) {
      return [...new Set(user.allowedBranchIds)];
    }
    if (!siteFilter.length) return [];
    const sites = await this.prisma.site.findMany({
      where: { organizationId: user.organizationId, id: { in: siteFilter } },
      select: { branchId: true },
    });
    return [...new Set(sites.map((s) => s.branchId))];
  }

  private async assertBranchInScope(
    user: AuthUser,
    branchId: string,
  ): Promise<void> {
    const scoped = await this.scopedBranchIds(user);
    if (scoped === null) return;
    if (!scoped.includes(branchId)) {
      throw new ForbiddenException({
        error: 'BRANCH_SCOPE_DENIED',
        message: 'Branch is outside your assigned scope',
      });
    }
  }

  async list(
    user: AuthUser,
    filters?: {
      branchId?: string;
      status?: EmployeeStatus;
      employmentType?: EmploymentType;
      q?: string;
    },
  ) {
    this.assertStaff(user);
    const org = user.organizationId;
    const scoped = await this.scopedBranchIds(user);

    if (filters?.branchId) {
      await this.assertBranchInScope(user, filters.branchId);
    }

    if (scoped && scoped.length === 0) {
      return {
        rows: [] as BranchStaffRowDto[],
        branches: [],
        summary: { total: 0, active: 0, onLeave: 0, suspended: 0, guards: 0 },
        canManage: true,
        notes: ['No branch in your site scope.'],
      };
    }

    const branchWhere: Prisma.BranchWhereInput = {
      organizationId: org,
      ...(scoped ? { id: { in: scoped } } : {}),
    };
    const branches = await this.prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, code: true, name: true, isActive: true },
      orderBy: { code: 'asc' },
    });

    const where: Prisma.EmployeeWhereInput = {
      organizationId: org,
      ...(scoped ? { branchId: { in: scoped } } : {}),
      ...(filters?.branchId ? { branchId: filters.branchId } : {}),
      status: filters?.status ?? { not: EmployeeStatus.TERMINATED },
      ...(filters?.employmentType
        ? { employmentType: filters.employmentType }
        : {}),
      ...(filters?.q
        ? {
            OR: [
              { fullName: { contains: filters.q, mode: 'insensitive' } },
              { employeeNumber: { contains: filters.q, mode: 'insensitive' } },
              { email: { contains: filters.q, mode: 'insensitive' } },
              { phone: { contains: filters.q, mode: 'insensitive' } },
              { department: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.employee.findMany({
      where,
      orderBy: [{ fullName: 'asc' }],
      take: 500,
      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        email: true,
        phone: true,
        department: true,
        employmentType: true,
        status: true,
        hireDate: true,
        branchId: true,
        userId: true,
        guardProfileId: true,
        guardProfile: { select: { id: true, status: true } },
      },
    });

    const guardIds = rows
      .map((r) => r.guardProfileId)
      .filter(Boolean) as string[];
    const deployments = guardIds.length
      ? await this.prisma.guardDeployment.findMany({
          where: {
            organizationId: org,
            status: DeploymentStatus.ACTIVE,
            guardId: { in: guardIds },
          },
          orderBy: { startDate: 'desc' },
          select: { guardId: true, siteId: true },
        })
      : [];
    const deploymentByGuard = new Map<string, string>();
    for (const d of deployments) {
      if (!deploymentByGuard.has(d.guardId)) {
        deploymentByGuard.set(d.guardId, d.siteId);
      }
    }
    const siteIds = [...new Set([...deploymentByGuard.values()])];
    const sites = siteIds.length
      ? await this.prisma.site.findMany({
          where: { organizationId: org, id: { in: siteIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const siteLabels = new Map(sites.map((s) => [s.id, s]));
    const branchLabels = new Map(branches.map((b) => [b.id, b]));

    const mapped: BranchStaffRowDto[] = rows.map((r) => {
      const branch = r.branchId ? branchLabels.get(r.branchId) : undefined;
      const siteId = r.guardProfileId
        ? deploymentByGuard.get(r.guardProfileId)
        : undefined;
      const site = siteId ? siteLabels.get(siteId) : undefined;
      return {
        id: r.id,
        employeeNumber: r.employeeNumber,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        department: r.department,
        employmentType: r.employmentType,
        status: r.status,
        hireDate: r.hireDate,
        branchId: r.branchId,
        branchCode: branch?.code ?? null,
        branchName: branch?.name ?? null,
        guardId: r.guardProfile?.id ?? null,
        guardStatus: r.guardProfile?.status ?? null,
        siteId: site?.id ?? null,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        hasLogin: Boolean(r.userId),
        canEdit: true,
      };
    });

    const summary = {
      total: mapped.length,
      active: mapped.filter((r) => r.status === EmployeeStatus.ACTIVE).length,
      onLeave: mapped.filter((r) => r.status === EmployeeStatus.ON_LEAVE)
        .length,
      suspended: mapped.filter((r) => r.status === EmployeeStatus.SUSPENDED)
        .length,
      guards: mapped.filter((r) => Boolean(r.guardId)).length,
    };

    await this.audit.record({
      organizationId: org,
      actorId: user.id,
      action: 'operations.branch_staff.listed',
      resourceType: 'BranchStaff',
      after: { count: mapped.length, branchIds: scoped },
    });

    return {
      rows: mapped,
      branches,
      summary,
      canManage: true,
      notes: [
        'Staff posted to the branch(es) in your scope. Add / edit / deactivate office staff here.',
        'Guard duty status and readiness stay the Guards console (guards.manage). Exits stay HR Movements.',
      ],
    };
  }

  async create(dto: CreateBranchStaffDto, user: AuthUser) {
    this.assertStaff(user);
    const org = user.organizationId;
    const scoped = await this.scopedBranchIds(user);

    if (dto.employmentType === EmploymentType.GUARD) {
      throw new BadRequestException({
        error: 'GUARD_PROFILE_VIA_GUARDS_CONSOLE',
        message:
          'Guard profiles are created in the Guards console / Recruitment so duty, deployments and attendance stay consistent. Add office staff here.',
      });
    }

    if (scoped && scoped.length === 0) {
      throw new ForbiddenException({
        error: 'BRANCH_SCOPE_DENIED',
        message: 'No branch in your scope',
      });
    }

    let branchId = dto.branchId;
    if (branchId) {
      await this.assertBranchInScope(user, branchId);
    } else if (scoped && scoped.length === 1) {
      branchId = scoped[0];
    } else {
      throw new BadRequestException({
        error: 'BRANCH_REQUIRED',
        message: 'Choose a branch in your scope',
      });
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: org },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException({
        error: 'INVALID_BRANCH',
        message: 'Branch not found in this organization',
      });
    }

    const employeeNumber =
      dto.employeeNumber?.trim() ||
      (await nextEmployeeNumber(this.prisma, org));
    const duplicate = await this.prisma.employee.findFirst({
      where: { organizationId: org, employeeNumber },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        error: 'EMPLOYEE_NUMBER_IN_USE',
        message: `Employee number ${employeeNumber} already exists`,
      });
    }

    const created = await this.prisma.employee.create({
      data: {
        organizationId: org,
        branchId,
        employeeNumber,
        fullName: dto.fullName.trim(),
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        department: dto.department?.trim() || null,
        employmentType: dto.employmentType ?? EmploymentType.OTHER,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : new Date(),
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: org,
      actorId: user.id,
      action: 'operations.branch_staff.created',
      resourceType: 'Employee',
      resourceId: created.id,
      after: created,
    });

    return created;
  }

  async update(id: string, dto: UpdateBranchStaffDto, user: AuthUser) {
    this.assertStaff(user);
    const org = user.organizationId;
    const scoped = await this.scopedBranchIds(user);

    const before = await this.prisma.employee.findFirst({
      where: { id, organizationId: org },
    });
    if (!before) throw new NotFoundException('Employee not found');
    if (scoped && (!before.branchId || !scoped.includes(before.branchId))) {
      throw new NotFoundException('Employee not found in your branch scope');
    }

    if (dto.status && !EDITABLE_STATUSES.includes(dto.status)) {
      throw new BadRequestException({
        error: 'USE_HR_EXIT',
        message:
          'Termination / exit is handled by HR Movements — Branch Ops can suspend or mark leave.',
      });
    }
    if (dto.status && before.guardProfileId) {
      throw new BadRequestException({
        error: 'GUARD_STATUS_VIA_GUARDS_CONSOLE',
        message:
          'This employee is a guard — change duty status in the Guards console so deployments, alertness and attendance stay consistent.',
      });
    }
    if (
      dto.employmentType === EmploymentType.GUARD &&
      before.employmentType !== EmploymentType.GUARD
    ) {
      throw new BadRequestException({
        error: 'GUARD_PROFILE_VIA_GUARDS_CONSOLE',
        message:
          'Converting an employee into a guard is done through Recruitment / the Guards console.',
      });
    }
    if (dto.branchId) {
      await this.assertBranchInScope(user, dto.branchId);
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined
          ? { fullName: dto.fullName.trim() }
          : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.department !== undefined
          ? { department: dto.department?.trim() || null }
          : {}),
        ...(dto.employmentType !== undefined
          ? { employmentType: dto.employmentType }
          : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.audit.record({
      organizationId: org,
      actorId: user.id,
      action: 'operations.branch_staff.updated',
      resourceType: 'Employee',
      resourceId: id,
      before,
      after: updated,
    });

    return updated;
  }
}
