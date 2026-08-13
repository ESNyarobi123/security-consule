import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateCustomerSalaryAssignmentDto,
  CustomerSalaryAssignmentResponseDto,
  UpdateCustomerSalaryAssignmentDto,
} from '../presentation/dto/customer-payroll.dto';

@Injectable()
export class CustomerSalaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForCustomer(customerId: string, organizationId: string) {
    const rows = await this.prisma.customerSalaryAssignment.findMany({
      where: { organizationId, customerId },
      orderBy: [{ customerEmployeeId: 'asc' }, { effectiveFrom: 'desc' }],
    });
    const empIds = [...new Set(rows.map((r) => r.customerEmployeeId))];
    const employees = await this.prisma.customerEmployee.findMany({
      where: { id: { in: empIds }, customerId, organizationId },
      select: { id: true, fullName: true, employeeNumber: true, isActive: true },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));
    return rows.map((r) =>
      this.toDto(r, empMap.get(r.customerEmployeeId)),
    );
  }

  async create(
    customerId: string,
    dto: CreateCustomerSalaryAssignmentDto,
    user: AuthUser,
  ) {
    await this.assertCustomerEmployee(
      customerId,
      dto.customerEmployeeId,
      user.organizationId,
    );

    const row = await this.prisma.customerSalaryAssignment.create({
      data: {
        organizationId: user.organizationId,
        customerId,
        customerEmployeeId: dto.customerEmployeeId,
        basicSalary: new Prisma.Decimal(dto.basicSalary),
        currency: dto.currency ?? 'TZS',
        hourlyRate:
          dto.hourlyRate != null
            ? new Prisma.Decimal(dto.hourlyRate)
            : undefined,
        allowances: dto.allowances as Prisma.InputJsonValue | undefined,
        deductions: dto.deductions as Prisma.InputJsonValue | undefined,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveUntil: dto.effectiveUntil
          ? new Date(dto.effectiveUntil)
          : undefined,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'customer_payroll.salary.created',
      resourceType: 'CustomerSalaryAssignment',
      resourceId: row.id,
      after: row,
    });

    const emp = await this.prisma.customerEmployee.findFirst({
      where: { id: dto.customerEmployeeId },
    });
    return this.toDto(row, emp ?? undefined);
  }

  async update(
    customerId: string,
    assignmentId: string,
    dto: UpdateCustomerSalaryAssignmentDto,
    user: AuthUser,
  ) {
    const existing = await this.prisma.customerSalaryAssignment.findFirst({
      where: {
        id: assignmentId,
        customerId,
        organizationId: user.organizationId,
      },
    });
    if (!existing) throw new NotFoundException('Salary assignment not found');

    const row = await this.prisma.customerSalaryAssignment.update({
      where: { id: assignmentId },
      data: {
        basicSalary:
          dto.basicSalary != null
            ? new Prisma.Decimal(dto.basicSalary)
            : undefined,
        currency: dto.currency,
        hourlyRate:
          dto.hourlyRate != null
            ? new Prisma.Decimal(dto.hourlyRate)
            : dto.hourlyRate === null
              ? null
              : undefined,
        allowances: dto.allowances as Prisma.InputJsonValue | undefined,
        deductions: dto.deductions as Prisma.InputJsonValue | undefined,
        effectiveUntil:
          dto.effectiveUntil != null
            ? new Date(dto.effectiveUntil)
            : dto.effectiveUntil === null
              ? null
              : undefined,
        isActive: dto.isActive,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'customer_payroll.salary.updated',
      resourceType: 'CustomerSalaryAssignment',
      resourceId: row.id,
      after: row,
    });

    const emp = await this.prisma.customerEmployee.findFirst({
      where: { id: row.customerEmployeeId },
    });
    return this.toDto(row, emp ?? undefined);
  }

  async getActiveForCustomerEmployee(
    customerEmployeeId: string,
    organizationId: string,
    asOf: Date,
  ) {
    return this.prisma.customerSalaryAssignment.findFirst({
      where: {
        customerEmployeeId,
        organizationId,
        isActive: true,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async assertCustomerEmployee(
    customerId: string,
    customerEmployeeId: string,
    organizationId: string,
  ) {
    const emp = await this.prisma.customerEmployee.findFirst({
      where: { id: customerEmployeeId, customerId, organizationId, isActive: true },
    });
    if (!emp) {
      throw new BadRequestException('INVALID_CUSTOMER_EMPLOYEE');
    }
  }

  private toDto(
    row: {
      id: string;
      organizationId: string;
      customerId: string;
      customerEmployeeId: string;
      basicSalary: Prisma.Decimal;
      currency: string;
      hourlyRate: Prisma.Decimal | null;
      allowances: unknown;
      deductions: unknown;
      effectiveFrom: Date;
      effectiveUntil: Date | null;
      isActive: boolean;
      createdAt: Date;
    },
    emp?: {
      fullName: string;
      employeeNumber: string | null;
      isActive: boolean;
    },
  ): CustomerSalaryAssignmentResponseDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      customerId: row.customerId,
      customerEmployeeId: row.customerEmployeeId,
      employeeName: emp?.fullName,
      employeeNumber: emp?.employeeNumber ?? undefined,
      basicSalary: Number(row.basicSalary),
      currency: row.currency,
      hourlyRate: row.hourlyRate != null ? Number(row.hourlyRate) : null,
      allowances: row.allowances,
      deductions: row.deductions,
      effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  }
}
