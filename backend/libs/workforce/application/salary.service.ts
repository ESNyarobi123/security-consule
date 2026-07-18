import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { EmployeesService } from './employees.service';
import {
  CreateSalaryAssignmentDto,
  SalaryAssignmentResponseDto,
} from '../presentation/dto/salary.dto';

@Injectable()
export class SalaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
  ) {}

  async assign(
    dto: CreateSalaryAssignmentDto,
    user: AuthUser,
  ): Promise<SalaryAssignmentResponseDto> {
    await this.employees.getById(dto.employeeId, user.organizationId);

    await this.prisma.salaryAssignment.updateMany({
      where: {
        employeeId: dto.employeeId,
        organizationId: user.organizationId,
        isActive: true,
        effectiveUntil: null,
      },
      data: {
        isActive: false,
        effectiveUntil: new Date(dto.effectiveFrom),
      },
    });

    const assignment = await this.prisma.salaryAssignment.create({
      data: {
        organizationId: user.organizationId,
        employeeId: dto.employeeId,
        basicSalary: new Prisma.Decimal(dto.basicSalary),
        currency: dto.currency ?? 'TZS',
        hourlyRate: dto.hourlyRate
          ? new Prisma.Decimal(dto.hourlyRate)
          : undefined,
        allowances: dto.allowances ?? {},
        effectiveFrom: new Date(dto.effectiveFrom),
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'salary.assigned',
      resourceType: 'SalaryAssignment',
      resourceId: assignment.id,
      after: assignment,
    });

    return this.toDto(assignment);
  }

  async getActiveForEmployee(employeeId: string, organizationId: string, asOf: Date) {
    return this.prisma.salaryAssignment.findFirst({
      where: {
        employeeId,
        organizationId,
        isActive: true,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async list(
    organizationId: string,
    employeeId?: string,
  ): Promise<SalaryAssignmentResponseDto[]> {
    const rows = await this.prisma.salaryAssignment.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(employeeId ? { employeeId } : {}),
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rows.map((a) => this.toDto(a));
  }

  private toDto(a: {
    id: string;
    organizationId: string;
    employeeId: string;
    basicSalary: Prisma.Decimal;
    currency: string;
    hourlyRate: Prisma.Decimal | null;
    allowances: unknown;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
    isActive: boolean;
    createdAt: Date;
  }): SalaryAssignmentResponseDto {
    return {
      id: a.id,
      organizationId: a.organizationId,
      employeeId: a.employeeId,
      basicSalary: Number(a.basicSalary),
      currency: a.currency,
      hourlyRate: a.hourlyRate ? Number(a.hourlyRate) : null,
      allowances: a.allowances,
      effectiveFrom: a.effectiveFrom,
      effectiveUntil: a.effectiveUntil,
      isActive: a.isActive,
      createdAt: a.createdAt,
    };
  }
}
