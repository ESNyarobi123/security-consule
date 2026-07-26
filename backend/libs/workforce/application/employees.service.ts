import {
  BadRequestException,
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
  UpdateEmployeeDto,
} from '../presentation/dto/employee.dto';

// note: userId link validated in update()

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

    if (dto.userId) {
      const loginUser = await this.prisma.user.findFirst({
        where: { id: dto.userId, organizationId: user.organizationId },
      });
      if (!loginUser) {
        throw new NotFoundException('User account not found in this organization');
      }
      const linked = await this.prisma.employee.findFirst({
        where: {
          organizationId: user.organizationId,
          userId: dto.userId,
        },
      });
      if (linked) {
        throw new ConflictException(
          `User already linked to employee ${linked.employeeNumber}`,
        );
      }
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

  async list(
    organizationId: string,
    status?: EmployeeStatus,
  ): Promise<EmployeeResponseDto[]> {
    const rows = await this.prisma.employee.findMany({
      where: {
        organizationId,
        ...(status
          ? { status }
          : { status: { not: EmployeeStatus.TERMINATED } }),
      },
      orderBy: { fullName: 'asc' },
    });
    return rows.map((e) => this.toDto(e));
  }

  async get(
    id: string,
    organizationId: string,
  ): Promise<EmployeeResponseDto> {
    return this.toDto(await this.getById(id, organizationId));
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    user: AuthUser,
  ): Promise<EmployeeResponseDto> {
    const before = await this.getById(id, user.organizationId);

    if (dto.status === EmployeeStatus.TERMINATED) {
      throw new BadRequestException(
        'Use HR Movements (EXIT) to terminate an employee — direct PATCH to TERMINATED is not allowed',
      );
    }

    if (dto.userId !== undefined && dto.userId !== null) {
      const loginUser = await this.prisma.user.findFirst({
        where: { id: dto.userId, organizationId: user.organizationId },
      });
      if (!loginUser) {
        throw new NotFoundException('User account not found in this organization');
      }
      const linked = await this.prisma.employee.findFirst({
        where: {
          organizationId: user.organizationId,
          userId: dto.userId,
          NOT: { id },
        },
      });
      if (linked) {
        throw new ConflictException(
          `User already linked to employee ${linked.employeeNumber}`,
        );
      }
    }

    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.employmentType !== undefined
          ? { employmentType: dto.employmentType }
          : {}),
        ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'employee.updated',
      resourceType: 'Employee',
      resourceId: id,
      before,
      after: employee,
    });

    return this.toDto(employee);
  }

  async getById(id: string, organizationId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  /** Minimal user directory for HR ESS linking (hr.manage). */
  async listLinkableUsers(organizationId: string) {
    const users = await this.prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, email: true, fullName: true, isActive: true },
      orderBy: { fullName: 'asc' },
      take: 500,
    });
    return users;
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
