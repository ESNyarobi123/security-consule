import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateDepartmentDto,
  DepartmentResponseDto,
  UpdateDepartmentDto,
} from '../presentation/dto/enterprise.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateDepartmentDto,
    user: AuthUser,
  ): Promise<DepartmentResponseDto> {
    const exists = await this.prisma.department.findFirst({
      where: { organizationId: user.organizationId, code: dto.code },
    });
    if (exists) throw new ConflictException('Department code already exists');

    const dept = await this.prisma.department.create({
      data: {
        code: dto.code,
        name: dto.name,
        branchId: dto.branchId,
        organizationId: user.organizationId,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'department.created',
      resourceType: 'Department',
      resourceId: dept.id,
      after: dept,
    });

    return {
      id: dept.id,
      organizationId: dept.organizationId,
      branchId: dept.branchId,
      code: dept.code,
      name: dept.name,
      isActive: dept.isActive,
    };
  }

  async list(organizationId: string): Promise<DepartmentResponseDto[]> {
    const rows = await this.prisma.department.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
    return rows.map((d) => this.toDto(d));
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
    user: AuthUser,
  ): Promise<DepartmentResponseDto> {
    const existing = await this.prisma.department.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Department not found',
      });
    }
    const dept = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'department.updated',
      resourceType: 'Department',
      resourceId: dept.id,
      before: existing,
      after: dept,
    });
    return this.toDto(dept);
  }

  private toDto(d: {
    id: string;
    organizationId: string;
    branchId: string | null;
    code: string;
    name: string;
    isActive: boolean;
  }): DepartmentResponseDto {
    return {
      id: d.id,
      organizationId: d.organizationId,
      branchId: d.branchId,
      code: d.code,
      name: d.name,
      isActive: d.isActive,
    };
  }
}
