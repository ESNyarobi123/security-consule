import {
  ConflictException,
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

@Injectable()
export class GuardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly deployments: DeploymentsService,
  ) {}

  async create(dto: CreateGuardDto, user: AuthUser): Promise<GuardResponseDto> {
    const exists = await this.prisma.guardProfile.findFirst({
      where: {
        organizationId: user.organizationId,
        OR: [
          { employeeNumber: dto.employeeNumber },
          { userId: dto.userId },
        ],
      },
    });
    if (exists) throw new ConflictException('Guard profile already exists');

    const guard = await this.prisma.guardProfile.create({
      data: {
        organizationId: user.organizationId,
        userId: dto.userId,
        employeeNumber: dto.employeeNumber,
        phone: dto.phone,
        status: GuardStatus.ACTIVE,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'guard.created',
      resourceType: 'GuardProfile',
      resourceId: guard.id,
      after: guard,
    });

    return this.toDto(guard);
  }

  async list(organizationId: string): Promise<GuardResponseDto[]> {
    const rows = await this.prisma.guardProfile.findMany({
      where: { organizationId },
      orderBy: { employeeNumber: 'asc' },
      include: {
        employee: { select: { id: true, fullName: true } },
        deployments: {
          where: { status: DeploymentStatus.ACTIVE },
          orderBy: { startDate: 'desc' },
          take: 1,
          select: {
            id: true,
            siteId: true,
            startDate: true,
            status: true,
          },
        },
      },
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
    const existing = await this.prisma.guardProfile.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        employee: { select: { id: true, fullName: true } },
        deployments: {
          where: { status: DeploymentStatus.ACTIVE },
          orderBy: { startDate: 'desc' },
          take: 1,
          select: {
            id: true,
            siteId: true,
            startDate: true,
            status: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Guard not found');

    // SUSPENDED / TERMINATED: always force deploymentEligible false.
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
      include: {
        employee: { select: { id: true, fullName: true } },
        deployments: {
          where: { status: DeploymentStatus.ACTIVE },
          orderBy: { startDate: 'desc' },
          take: 1,
          select: {
            id: true,
            siteId: true,
            startDate: true,
            status: true,
          },
        },
      },
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

    const siteId = updated.deployments[0]?.siteId;
    const siteById = new Map<string, { id: string; code: string; name: string }>();
    if (siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: siteId, organizationId: user.organizationId },
        select: { id: true, code: true, name: true },
      });
      if (site) siteById.set(site.id, site);
    }

    return this.toDto(updated, siteById);
  }

  async getByUserId(userId: string, organizationId: string) {
    return this.prisma.guardProfile.findFirst({
      where: { userId, organizationId },
    });
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
