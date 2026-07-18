import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeStatus, EmploymentType } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateEmployeeDto,
  EmployeeResponseDto,
} from '../presentation/dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateEmployeeDto,
    user: AuthUser,
  ): Promise<EmployeeResponseDto> {
    const exists = await this.prisma.employee.findFirst({
      where: {
        organizationId: user.organizationId,
        employeeNumber: dto.employeeNumber,
      },
    });
    if (exists) throw new ConflictException('Employee number already exists');

    if (dto.guardProfileId) {
      const guard = await this.prisma.guardProfile.findFirst({
        where: {
          id: dto.guardProfileId,
          organizationId: user.organizationId,
        },
      });
      if (!guard) throw new NotFoundException('Guard profile not found');
    }

    const employee = await this.prisma.employee.create({
      data: {
        organizationId: user.organizationId,
        userId: dto.userId,
        guardProfileId: dto.guardProfileId,
        employeeNumber: dto.employeeNumber,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        department: dto.department,
        employmentType: dto.employmentType ?? EmploymentType.GUARD,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : new Date(),
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'employee.created',
      resourceType: 'Employee',
      resourceId: employee.id,
      after: employee,
    });

    return this.toDto(employee);
  }

  async list(organizationId: string): Promise<EmployeeResponseDto[]> {
    const rows = await this.prisma.employee.findMany({
      where: { organizationId, status: { not: EmployeeStatus.TERMINATED } },
      orderBy: { fullName: 'asc' },
    });
    return rows.map((e) => this.toDto(e));
  }

  async getById(id: string, organizationId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private toDto(e: {
    id: string;
    organizationId: string;
    userId: string | null;
    guardProfileId: string | null;
    employeeNumber: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    employmentType: EmploymentType;
    status: EmployeeStatus;
    hireDate: Date | null;
    createdAt: Date;
  }): EmployeeResponseDto {
    return {
      id: e.id,
      organizationId: e.organizationId,
      userId: e.userId,
      guardProfileId: e.guardProfileId,
      employeeNumber: e.employeeNumber,
      fullName: e.fullName,
      email: e.email,
      phone: e.phone,
      department: e.department,
      employmentType: e.employmentType,
      status: e.status,
      hireDate: e.hireDate,
      createdAt: e.createdAt,
    };
  }
}
