import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, AuthUser, ORG_WIDE_SITE_VIEW_ROLES } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  BranchResponseDto,
  CreateBranchDto,
  UpdateBranchDto,
} from '../presentation/dto/enterprise.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateBranchDto, user: AuthUser): Promise<BranchResponseDto> {
    const exists = await this.prisma.branch.findFirst({
      where: { organizationId: user.organizationId, code: dto.code },
    });
    if (exists) {
      throw new ConflictException('Branch code already exists');
    }

    const branch = await this.prisma.branch.create({
      data: {
        ...dto,
        organizationId: user.organizationId,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'branch.created',
      resourceType: 'Branch',
      resourceId: branch.id,
      after: branch,
    });

    return this.toDto(branch);
  }

  /**
   * Branch catalogue for pickers.
   *
   * Branch/site-scoped staff (Branch Manager, Field Officer, BD Manager, …) must
   * only see branches they actually operate in — otherwise a picker can offer a
   * branch that `assertBranchAccess` will reject on submit (dead-end 403) and
   * KPIs read as if the whole company were in scope. Org-wide roles are
   * unchanged. Site-only users get the branches their assigned sites belong to.
   */
  async list(
    organizationId: string,
    user?: AuthUser,
  ): Promise<BranchResponseDto[]> {
    const scope = user ? await this.resolveBranchScope(user) : null;
    if (scope !== null && scope.length === 0) return [];

    const rows = await this.prisma.branch.findMany({
      where: {
        organizationId,
        ...(scope !== null ? { id: { in: scope } } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((b) => this.toDto(b));
  }

  /** `null` = org-wide; otherwise the branch ids in the caller's scope. */
  private async resolveBranchScope(user: AuthUser): Promise<string[] | null> {
    if (user.roles.some((r) => ORG_WIDE_SITE_VIEW_ROLES.has(r))) return null;

    const allowed = new Set<string>(user.allowedBranchIds ?? []);
    if (allowed.size === 0 && (user.allowedSiteIds ?? []).length === 0) {
      return [];
    }
    if ((user.allowedSiteIds ?? []).length > 0) {
      const sites = await this.prisma.site.findMany({
        where: {
          organizationId: user.organizationId,
          id: { in: user.allowedSiteIds },
        },
        select: { branchId: true },
      });
      for (const site of sites) allowed.add(site.branchId);
    }
    return [...allowed];
  }

  async update(
    id: string,
    dto: UpdateBranchDto,
    user: AuthUser,
  ): Promise<BranchResponseDto> {
    const existing = await this.prisma.branch.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Branch not found',
      });
    }
    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'branch.updated',
      resourceType: 'Branch',
      resourceId: branch.id,
      before: existing,
      after: branch,
    });
    return this.toDto(branch);
  }

  private toDto(b: {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    region: string | null;
    isActive: boolean;
    createdAt: Date;
  }): BranchResponseDto {
    return {
      id: b.id,
      organizationId: b.organizationId,
      code: b.code,
      name: b.name,
      region: b.region,
      isActive: b.isActive,
      createdAt: b.createdAt,
    };
  }
}
