import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  PayrollCycleStatus,
  PayrollTenantType,
  Prisma,
} from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  calculatePayslip,
  attendanceHours,
  PayrollRules,
  PayslipLineItem,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import { SalaryService } from '@pssms/workforce';
import { EmployeeLoansService } from '@pssms/employee-loans';
import {
  CreatePayrollCycleDto,
  MarkPayrollPaidDto,
  PayrollCycleResponseDto,
  PayslipSnapshotResponseDto,
} from '../presentation/dto/payroll.dto';

const IMMUTABLE_STATUSES: PayrollCycleStatus[] = [
  PayrollCycleStatus.APPROVED,
  PayrollCycleStatus.PAID,
];

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly salary: SalaryService,
    private readonly loans: EmployeeLoansService,
  ) {}

  async createCycle(
    dto: CreatePayrollCycleDto,
    user: AuthUser,
  ): Promise<PayrollCycleResponseDto> {
    const ruleVersion = await this.prisma.payrollRuleVersion.findFirst({
      where: {
        organizationId: user.organizationId,
        isCurrent: true,
      },
    });
    if (!ruleVersion) {
      throw new BadRequestException('No current payroll rule version configured');
    }

    const cycleCode = `PAY-${dto.periodStart.slice(0, 7).replace(/-/g, '')}`;
    const exists = await this.prisma.payrollCycle.findFirst({
      where: { organizationId: user.organizationId, cycleCode },
    });
    if (exists) throw new BadRequestException('Cycle for period already exists');

    const cycle = await this.prisma.payrollCycle.create({
      data: {
        organizationId: user.organizationId,
        tenantType: dto.tenantType ?? PayrollTenantType.INTERNAL_COMPANY,
        customerId: dto.customerId,
        cycleCode,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        ruleVersionId: ruleVersion.id,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'payroll.cycle.created',
      resourceType: 'PayrollCycle',
      resourceId: cycle.id,
      after: cycle,
    });

    return this.toCycleDto(cycle);
  }

  async generatePayslips(
    cycleId: string,
    user: AuthUser,
  ): Promise<PayslipSnapshotResponseDto[]> {
    const cycle = await this.getCycleOrThrow(cycleId, user.organizationId);
    if (IMMUTABLE_STATUSES.includes(cycle.status)) {
      throw new ForbiddenException('Cannot regenerate approved/paid payroll');
    }

    await this.prisma.payslipSnapshot.deleteMany({ where: { cycleId } });

    const ruleVersion = await this.prisma.payrollRuleVersion.findUniqueOrThrow({
      where: { id: cycle.ruleVersionId },
    });
    const rules = ruleVersion.rules as unknown as PayrollRules;

    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId: user.organizationId,
        status: EmployeeStatus.ACTIVE,
      },
    });

    const snapshots: PayslipSnapshotResponseDto[] = [];

    for (const employee of employees) {
      const salaryAssignment = await this.salary.getActiveForEmployee(
        employee.id,
        user.organizationId,
        cycle.periodEnd,
      );
      if (!salaryAssignment) continue;

      const inputsSnapshot = await this.snapshotAttendanceInputs(
        employee,
        cycle.periodStart,
        cycle.periodEnd,
      );

      const allowanceItems: PayslipLineItem[] = [];
      const allowancesRaw = salaryAssignment.allowances as Record<string, number> | null;
      if (allowancesRaw) {
        for (const [code, amount] of Object.entries(allowancesRaw)) {
          allowanceItems.push({
            code,
            label: code,
            amount,
            type: 'EARNING',
          });
        }
      }

      const dueInstallments = await this.loans.getDueInstallmentsForEmployee(
        employee.id,
        user.organizationId,
        cycle.periodEnd,
      );
      const loanDeductions: PayslipLineItem[] = dueInstallments.map((i) => ({
        code: `LOAN-${i.loan.loanNumber}`,
        label: `Loan installment #${i.installmentNumber}`,
        amount: Number(i.amountDue),
        type: 'DEDUCTION' as const,
      }));

      const calc = calculatePayslip({
        basicSalary: Number(salaryAssignment.basicSalary),
        hoursWorked: inputsSnapshot.totalHours,
        hourlyRate: salaryAssignment.hourlyRate
          ? Number(salaryAssignment.hourlyRate)
          : undefined,
        allowances: allowanceItems,
        loanDeductions,
        rules,
      });

      const snapshot = await this.prisma.payslipSnapshot.create({
        data: {
          organizationId: user.organizationId,
          cycleId,
          employeeId: employee.id,
          employeeNumber: employee.employeeNumber,
          employeeName: employee.fullName,
          inputsSnapshot: inputsSnapshot as unknown as Prisma.InputJsonValue,
          allowancesSnapshot: allowanceItems as unknown as Prisma.InputJsonValue,
          deductionsSnapshot: loanDeductions as unknown as Prisma.InputJsonValue,
          calculationResult: calc as unknown as Prisma.InputJsonValue,
          grossPay: new Prisma.Decimal(calc.grossPay),
          totalDeductions: new Prisma.Decimal(calc.totalDeductions),
          netPay: new Prisma.Decimal(calc.netPay),
          ruleVersionId: ruleVersion.id,
          createdBy: user.id,
        },
      });

      snapshots.push(this.toPayslipDto(snapshot));
    }

    await this.prisma.payrollCycle.update({
      where: { id: cycleId },
      data: {
        status: PayrollCycleStatus.CALCULATED,
        reviewedBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'payroll.generated',
      resourceType: 'PayrollCycle',
      resourceId: cycleId,
      after: { payslipCount: snapshots.length },
    });

    return snapshots;
  }

  async submitForApproval(cycleId: string, user: AuthUser) {
    const cycle = await this.getCycleOrThrow(cycleId, user.organizationId);
    if (cycle.status !== PayrollCycleStatus.CALCULATED) {
      throw new BadRequestException('Cycle must be CALCULATED before approval');
    }

    const approval = await this.approvals.start(
      {
        workflowCode: 'payroll-approval',
        resourceType: 'PayrollCycle',
        resourceId: cycleId,
      },
      user,
    );

    const updated = await this.prisma.payrollCycle.update({
      where: { id: cycleId },
      data: {
        status: PayrollCycleStatus.PENDING_APPROVAL,
        approvalInstanceId: approval.id,
      },
    });

    return this.toCycleDto(updated);
  }

  async approveCycle(cycleId: string, user: AuthUser) {
    const cycle = await this.getCycleOrThrow(cycleId, user.organizationId);
    if (!cycle.approvalInstanceId) {
      throw new BadRequestException('Not submitted for approval');
    }

    await this.approvals.act(
      cycle.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    const updated = await this.prisma.payrollCycle.update({
      where: { id: cycleId },
      data: {
        status: PayrollCycleStatus.APPROVED,
        approvedBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'payroll.approved',
      resourceType: 'PayrollCycle',
      resourceId: cycleId,
      after: updated,
    });

    return this.toCycleDto(updated);
  }

  async markPaid(
    cycleId: string,
    dto: MarkPayrollPaidDto,
    user: AuthUser,
  ) {
    const cycle = await this.getCycleOrThrow(cycleId, user.organizationId);
    if (cycle.status !== PayrollCycleStatus.APPROVED) {
      throw new BadRequestException('Cycle must be APPROVED before payment');
    }

    const payslips = await this.prisma.payslipSnapshot.findMany({
      where: { cycleId },
    });

    for (const payslip of payslips) {
      const deductions = payslip.deductionsSnapshot as unknown as PayslipLineItem[];
      const loanCodes = deductions
        .filter((d) => d.code.startsWith('LOAN-'))
        .map((d) => d.code.replace('LOAN-', ''));

      if (loanCodes.length > 0) {
        const installments = await this.prisma.loanInstallment.findMany({
          where: {
            status: 'PENDING',
            loan: {
              employeeId: payslip.employeeId,
              loanNumber: { in: loanCodes },
            },
          },
        });
        for (const inst of installments) {
          await this.prisma.loanInstallment.update({
            where: { id: inst.id },
            data: {
              status: 'PAID',
              amountPaid: inst.amountDue,
              payslipSnapshotId: payslip.id,
              paidAt: new Date(),
            },
          });
        }
      }
    }

    const updated = await this.prisma.payrollCycle.update({
      where: { id: cycleId },
      data: {
        status: PayrollCycleStatus.PAID,
        paidAt: new Date(),
        paymentReference: dto.paymentReference,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'payroll.paid',
      resourceType: 'PayrollCycle',
      resourceId: cycleId,
      after: updated,
    });

    return this.toCycleDto(updated);
  }

  async listCycles(organizationId: string): Promise<PayrollCycleResponseDto[]> {
    const rows = await this.prisma.payrollCycle.findMany({
      where: { organizationId },
      orderBy: { periodStart: 'desc' },
      take: 24,
    });
    return rows.map((c) => this.toCycleDto(c));
  }

  async listPayslips(
    cycleId: string,
    organizationId: string,
  ): Promise<PayslipSnapshotResponseDto[]> {
    await this.getCycleOrThrow(cycleId, organizationId);
    const rows = await this.prisma.payslipSnapshot.findMany({
      where: { cycleId, organizationId },
      orderBy: { employeeName: 'asc' },
    });
    return rows.map((p) => this.toPayslipDto(p));
  }

  async getPayslip(id: string, organizationId: string) {
    const payslip = await this.prisma.payslipSnapshot.findFirst({
      where: { id, organizationId },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    return this.toPayslipDto(payslip);
  }

  private async snapshotAttendanceInputs(
    employee: { id: string; guardProfileId: string | null },
    periodStart: Date,
    periodEnd: Date,
  ) {
    if (!employee.guardProfileId) {
      return { totalHours: 0, attendances: [] as unknown[] };
    }

    const attendances = await this.prisma.guardAttendance.findMany({
      where: {
        guardId: employee.guardProfileId,
        clockInAt: { gte: periodStart, lte: periodEnd },
        clockOutAt: { not: null },
      },
    });

    const rows = attendances.map((a) => {
      const hours = attendanceHours(a.clockInAt, a.clockOutAt);
      return {
        attendanceId: a.id,
        siteId: a.siteId,
        clockInAt: a.clockInAt.toISOString(),
        clockOutAt: a.clockOutAt!.toISOString(),
        hours,
        supervisorApproved: a.supervisorApproved,
      };
    });

    const totalHours = rows.reduce((s, r) => s + r.hours, 0);

    return { totalHours, attendances: rows, snapshottedAt: new Date().toISOString() };
  }

  private async getCycleOrThrow(id: string, organizationId: string) {
    const cycle = await this.prisma.payrollCycle.findFirst({
      where: { id, organizationId },
    });
    if (!cycle) throw new NotFoundException('Payroll cycle not found');
    return cycle;
  }

  private toCycleDto(c: {
    id: string;
    organizationId: string;
    tenantType: PayrollTenantType;
    customerId: string | null;
    cycleCode: string;
    periodStart: Date;
    periodEnd: Date;
    status: PayrollCycleStatus;
    ruleVersionId: string;
    approvalInstanceId: string | null;
    createdBy: string;
    reviewedBy: string | null;
    approvedBy: string | null;
    paidAt: Date | null;
    paymentReference: string | null;
    createdAt: Date;
  }): PayrollCycleResponseDto {
    return {
      id: c.id,
      organizationId: c.organizationId,
      tenantType: c.tenantType,
      customerId: c.customerId,
      cycleCode: c.cycleCode,
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
      status: c.status,
      ruleVersionId: c.ruleVersionId,
      approvalInstanceId: c.approvalInstanceId,
      createdBy: c.createdBy,
      reviewedBy: c.reviewedBy,
      approvedBy: c.approvedBy,
      paidAt: c.paidAt,
      paymentReference: c.paymentReference,
      createdAt: c.createdAt,
    };
  }

  private toPayslipDto(p: {
    id: string;
    organizationId: string;
    cycleId: string;
    employeeId: string;
    employeeNumber: string;
    employeeName: string;
    inputsSnapshot: unknown;
    allowancesSnapshot: unknown;
    deductionsSnapshot: unknown;
    calculationResult: unknown;
    grossPay: Prisma.Decimal;
    totalDeductions: Prisma.Decimal;
    netPay: Prisma.Decimal;
    ruleVersionId: string;
    createdAt: Date;
  }): PayslipSnapshotResponseDto {
    return {
      id: p.id,
      organizationId: p.organizationId,
      cycleId: p.cycleId,
      employeeId: p.employeeId,
      employeeNumber: p.employeeNumber,
      employeeName: p.employeeName,
      inputsSnapshot: p.inputsSnapshot,
      allowancesSnapshot: p.allowancesSnapshot,
      deductionsSnapshot: p.deductionsSnapshot,
      calculationResult: p.calculationResult,
      grossPay: Number(p.grossPay),
      totalDeductions: Number(p.totalDeductions),
      netPay: Number(p.netPay),
      ruleVersionId: p.ruleVersionId,
      createdAt: p.createdAt,
    };
  }
}
