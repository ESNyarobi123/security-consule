import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeploymentStatus, GuardStatus } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { DeploymentsService } from '@pssms/operations';
import {
  CreateGuardDto,
  GuardResponseDto,
  LinkableGuardUserDto,
  UpdateGuardReadinessDto,
} from '../presentation/dto/guard.dto';

const INELIGIBLE_STATUSES: GuardStatus[] = [
  GuardStatus.SUSPENDED,
  GuardStatus.TERMINATED,
];

type GuardRow = {
  id: string;
  organizationId: string;
  userId: string;
  employeeNumber: string;
  status: GuardStatus;
  deploymentEligible: boolean;
  trainingCompleted: boolean;
  firearmAuthorized: boolean;
  firearmExpiry: Date | null;
  clearanceVerified: boolean;
  phone: string | null;
  photoUrl: string | null;
  createdAt: Date;
  employee?: { id: string; fullName: string } | null;
  deployments?: Array<{
    id: string;
    siteId: string;
    startDate: Date;
    status: DeploymentStatus;
  }>;
};

const GUARD_INCLUDE = {
  employee: { select: { id: true, fullName: true } },
  deployments: {
    where: { status: DeploymentStatus.ACTIVE },
    orderBy: { startDate: 'desc' as const },
    take: 1,
    select: {
      id: true,
      siteId: true,
      startDate: true,
      status: true,
    },
  },
};

@Injectable()
export class GuardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly deployments: DeploymentsService,
  ) {}

  /**
   * §4 Harden A4 — GuardProfile admin requires `guards.manage`
   * (not bare `operations.manage`; SUPERVISOR / CONTROL_ROOM / CCTV stay out).
   */
  private assertCanAdministerGuards(user: AuthUser): void {
    if (
      user.roles.includes('SUPER_ADMIN') ||
      user.permissions.includes('guards.manage')
    ) {
      return;
    }
    throw new ForbiddenException({
      error: 'FORBIDDEN',
      message: 'Missing permission: guards.manage',
    });
  }

  async create(dto: CreateGuardDto, user: AuthUser): Promise<GuardResponseDto> {
    this.assertCanAdministerGuards(user);

    const guardId = await this.prisma.$transaction(async (tx) => {
      // Company workforce only — never link customer/supplier portal accounts (§33).
      const iamUser = await tx.user.findFirst({
        where: {
          id: dto.userId,
          organizationId: user.organizationId,
          isActive: true,
          customerId: null,
          supplierId: null,
        },
        select: { id: true },
      });
      if (!iamUser) {
        throw new NotFoundException(
          'User not found (must be an active internal company account)',
        );
      }

      const exists = await tx.guardProfile.findFirst({
        where: {
          organizationId: user.organizationId,
          OR: [
            { employeeNumber: dto.employeeNumber },
            { userId: dto.userId },
          ],
        },
      });
      if (exists) throw new ConflictException('Guard profile already exists');

      if (dto.employeeId) {
        const employee = await tx.employee.findFirst({
          where: {
            id: dto.employeeId,
            organizationId: user.organizationId,
          },
          select: { id: true, guardProfileId: true },
        });
        if (!employee) throw new NotFoundException('Employee not found');
        if (employee.guardProfileId) {
          throw new ConflictException(
            'Employee is already linked to a guard profile',
          );
        }
      }

      const created = await tx.guardProfile.create({
        data: {
          organizationId: user.organizationId,
          userId: dto.userId,
          employeeNumber: dto.employeeNumber,
          phone: dto.phone,
          status: GuardStatus.ACTIVE,
          deploymentEligible: dto.deploymentEligible ?? false,
        },
      });

      if (dto.employeeId) {
        await tx.employee.update({
          where: { id: dto.employeeId },
          data: { guardProfileId: created.id },
        });
      }

      return created.id;
    });

    const enriched = await this.prisma.guardProfile.findFirst({
      where: { id: guardId, organizationId: user.organizationId },
      include: GUARD_INCLUDE,
    });
    if (!enriched) throw new NotFoundException('Guard not found');

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'guard.created',
      resourceType: 'GuardProfile',
      resourceId: enriched.id,
      after: enriched,
    });

    return this.toDto(enriched);
  }

  async listLinkableUsers(
    organizationId: string,
    actor: AuthUser,
  ): Promise<LinkableGuardUserDto[]> {
    this.assertCanAdministerGuards(actor);

    const linked = await this.prisma.guardProfile.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const linkedIds = linked.map((g) => g.userId);

    return this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        customerId: null,
        supplierId: null,
        ...(linkedIds.length > 0 ? { id: { notIn: linkedIds } } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
      },
      orderBy: { fullName: 'asc' },
      take: 500,
    });
  }

  async list(organizationId: string): Promise<GuardResponseDto[]> {
    const rows = await this.prisma.guardProfile.findMany({
      where: { organizationId },
      orderBy: { employeeNumber: 'asc' },
      include: GUARD_INCLUDE,
    });

    const siteIds = [
      ...new Set(
        rows
          .map((g) => g.deployments[0]?.siteId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const sites =
      siteIds.length === 0
        ? []
        : await this.prisma.site.findMany({
            where: { organizationId, id: { in: siteIds } },
            select: { id: true, code: true, name: true },
          });
    const siteById = new Map(sites.map((s) => [s.id, s]));

    return rows.map((g) => this.toDto(g, siteById));
  }

  async updateStatus(
    id: string,
    status: GuardStatus,
    deploymentEligible: boolean | undefined,
    user: AuthUser,
  ): Promise<GuardResponseDto> {
    this.assertCanAdministerGuards(user);

    const existing = await this.loadGuard(id, user.organizationId);
    if (!existing) throw new NotFoundException('Guard not found');

    // SUSPENDED / TERMINATED: always force deploymentEligible false.
    // G3: incomplete training/clearance does NOT hard-block deployable.
    const forceIneligible = INELIGIBLE_STATUSES.includes(status);

    const updated = await this.prisma.guardProfile.update({
      where: { id },
      data: {
        status,
        ...(forceIneligible
          ? { deploymentEligible: false }
          : deploymentEligible !== undefined
            ? { deploymentEligible }
            : {}),
      },
      include: GUARD_INCLUDE,
    });

    if (forceIneligible) {
      await this.deployments.endAllActiveForGuard(id, user, {
        reason: `guard.status.${status.toLowerCase()}`,
      });
      updated.deployments = [];
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'guard.status.updated',
      resourceType: 'GuardProfile',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.toDtoWithSite(updated, user.organizationId);
  }

  async updateReadiness(
    id: string,
    dto: UpdateGuardReadinessDto,
    user: AuthUser,
  ): Promise<GuardResponseDto> {
    this.assertCanAdministerGuards(user);

    const existing = await this.loadGuard(id, user.organizationId);
    if (!existing) throw new NotFoundException('Guard not found');

    const data: {
      trainingCompleted?: boolean;
      firearmAuthorized?: boolean;
      firearmExpiry?: Date | null;
      clearanceVerified?: boolean;
    } = {};

    if (dto.trainingCompleted !== undefined) {
      data.trainingCompleted = dto.trainingCompleted;
    }
    if (dto.firearmAuthorized !== undefined) {
      data.firearmAuthorized = dto.firearmAuthorized;
    }
    if (dto.clearanceVerified !== undefined) {
      data.clearanceVerified = dto.clearanceVerified;
    }
    if (dto.firearmExpiry !== undefined) {
      data.firearmExpiry =
        dto.firearmExpiry === null
          ? null
          : new Date(`${dto.firearmExpiry.slice(0, 10)}T00:00:00.000Z`);
    }

    if (Object.keys(data).length === 0) {
      return this.toDtoWithSite(existing, user.organizationId);
    }

    const updated = await this.prisma.guardProfile.update({
      where: { id },
      data,
      include: GUARD_INCLUDE,
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'guard.readiness.updated',
      resourceType: 'GuardProfile',
      resourceId: id,
      before: existing,
      after: updated,
    });

    return this.toDtoWithSite(updated, user.organizationId);
  }

  async getByUserId(userId: string, organizationId: string) {
    return this.prisma.guardProfile.findFirst({
      where: { userId, organizationId },
    });
  }

  private loadGuard(id: string, organizationId: string) {
    return this.prisma.guardProfile.findFirst({
      where: { id, organizationId },
      include: GUARD_INCLUDE,
    });
  }

  private async toDtoWithSite(
    g: GuardRow,
    organizationId: string,
  ): Promise<GuardResponseDto> {
    const siteId = g.deployments?.[0]?.siteId;
    const siteById = new Map<
      string,
      { id: string; code: string; name: string }
    >();
    if (siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: siteId, organizationId },
        select: { id: true, code: true, name: true },
      });
      if (site) siteById.set(site.id, site);
    }
    return this.toDto(g, siteById);
  }

  private toDto(
    g: GuardRow,
    siteById?: Map<string, { id: string; code: string; name: string }>,
  ): GuardResponseDto {
    const active = g.deployments?.[0];
    const site = active ? siteById?.get(active.siteId) : undefined;

    return {
      id: g.id,
      organizationId: g.organizationId,
      userId: g.userId,
      employeeNumber: g.employeeNumber,
      status: g.status,
      deploymentEligible: g.deploymentEligible,
      trainingCompleted: g.trainingCompleted,
      firearmAuthorized: g.firearmAuthorized,
      firearmExpiry: g.firearmExpiry ?? null,
      clearanceVerified: g.clearanceVerified,
      phone: g.phone ?? null,
      photoUrl: g.photoUrl ?? null,
      createdAt: g.createdAt,
      employee: g.employee
        ? { employeeId: g.employee.id, fullName: g.employee.fullName }
        : null,
      activeDeployment: active
        ? {
            id: active.id,
            siteId: active.siteId,
            siteCode: site?.code ?? null,
            siteName: site?.name ?? null,
            startDate: active.startDate,
            status: active.status,
          }
        : null,
    };
  }
}
