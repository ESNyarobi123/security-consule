import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  AuthUser,
  assertBranchAccess,
  assertSiteAccess,
  resolveSiteIdFilter,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateSiteDto,
  SiteResponseDto,
  UpdateSiteDto,
} from '../presentation/dto/enterprise.dto';

type SiteRow = {
  id: string;
  organizationId: string;
  branchId: string;
  customerId: string | null;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
};

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toDto(site: SiteRow): SiteResponseDto {
    return {
      id: site.id,
      organizationId: site.organizationId,
      branchId: site.branchId,
      customerId: site.customerId,
      code: site.code,
      name: site.name,
      address: site.address,
      isActive: site.isActive,
    };
  }

  async create(dto: CreateSiteDto, user: AuthUser): Promise<SiteResponseDto> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId: user.organizationId },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    assertBranchAccess(user, dto.branchId);

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: dto.customerId,
          organizationId: user.organizationId,
        },
      });
      if (!customer) throw new NotFoundException('Customer not found');
    }

    const exists = await this.prisma.site.findFirst({
      where: { organizationId: user.organizationId, code: dto.code },
    });
    if (exists) throw new ConflictException('Site code already exists');

    const site = await this.prisma.site.create({
      data: {
        code: dto.code,
        name: dto.name,
        branchId: dto.branchId,
        customerId: dto.customerId,
        address: dto.address,
        organizationId: user.organizationId,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'site.created',
      resourceType: 'Site',
      resourceId: site.id,
      after: site,
    });

    return this.toDto(site);
  }

  /**
   * Module 6-F — update name/address/isActive.
   * When `requiredCustomerId` is set, site must belong to that customer (CRM wrapper).
   */
  async update(
    siteId: string,
    dto: UpdateSiteDto,
    user: AuthUser,
    opts?: { requiredCustomerId?: string },
  ): Promise<SiteResponseDto> {
    const existing = await this.prisma.site.findFirst({
      where: { id: siteId, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Site not found');

    if (
      opts?.requiredCustomerId &&
      existing.customerId !== opts.requiredCustomerId
    ) {
      throw new NotFoundException('Site not found for this customer');
    }

    assertSiteAccess(user, existing.id);
    assertBranchAccess(user, existing.branchId);

    const name =
      dto.name !== undefined
        ? dto.name.trim()
        : undefined;
    if (name !== undefined && name.length < 2) {
      throw new BadRequestException({
        error: 'INVALID_SITE_NAME',
        message: 'Site name must be at least 2 characters',
      });
    }

    const address =
      dto.address === undefined
        ? undefined
        : dto.address === null || !String(dto.address).trim()
          ? null
          : String(dto.address).trim();

    const site = await this.prisma.site.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'site.updated',
      resourceType: 'Site',
      resourceId: site.id,
      before: existing,
      after: site,
    });

    return this.toDto(site);
  }

  async list(
    organizationId: string,
    user?: AuthUser,
  ): Promise<SiteResponseDto[]> {
    const siteFilter = user ? resolveSiteIdFilter(user) : null;
    const rows = await this.prisma.site.findMany({
      where: {
        organizationId,
        ...(siteFilter !== null ? { id: { in: siteFilter } } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((s) => this.toDto(s));
  }
}
