import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  BranchResponseDto,
  CreateBranchDto,
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

  async list(organizationId: string): Promise<BranchResponseDto[]> {
    const rows = await this.prisma.branch.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
    return rows.map((b) => this.toDto(b));
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
