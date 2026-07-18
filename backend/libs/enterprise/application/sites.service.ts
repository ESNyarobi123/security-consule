import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { CreateSiteDto, SiteResponseDto } from '../presentation/dto/enterprise.dto';

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateSiteDto, user: AuthUser): Promise<SiteResponseDto> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId: user.organizationId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

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

    return {
      id: site.id,
      organizationId: site.organizationId,
      branchId: site.branchId,
      customerId: site.customerId,
      code: site.code,
      name: site.name,
      isActive: site.isActive,
    };
  }

  async list(organizationId: string): Promise<SiteResponseDto[]> {
    const rows = await this.prisma.site.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
    return rows.map((s) => ({
      id: s.id,
      organizationId: s.organizationId,
      branchId: s.branchId,
      customerId: s.customerId,
      code: s.code,
      name: s.name,
      isActive: s.isActive,
    }));
  }
}
