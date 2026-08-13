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
  resolvePayrollRules,
  unpaidLeaveDeduction,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import { SalaryService } from '@pssms/workforce';
import { EmployeeLoansService } from '@pssms/employee-loans';
import { CustomerSalaryService } from './customer-salary.service';
import { PayrollDueService } from './payroll-due.service';
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

const ALLOWANCE_LABELS: Record<string, string> = {
  TRANSPORT: 'Transport allowance',
  RISK: 'Risk allowance',
  SITE: 'Site allowance',
  HOUSING: 'Housing allowance',
  MEAL: 'Meal allowance',
};

const PAYROLL_RESOURCE = 'PayrollCycle';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly salary: SalaryService,
    private readonly loans: EmployeeLoansService,
    private readonly customerSalary: CustomerSalaryService,
    private readonly payrollDue: PayrollDueService,
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

    const tenantType = dto.tenantType ?? PayrollTenantType.INTERNAL_COMPANY;
    let customerCode: string | undefined;
    if (tenantType === PayrollTenantType.CUSTOMER_MANAGED_PAYROLL) {
      if (!dto.customerId) {
        throw new BadRequestException('CUSTOMER_REQUIRED_FOR_CUSTOMER_PAYROLL');
      }
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: dto.customerId,
          organizationId: user.organizationId,
          isActive: true,
        },
      });
      if (!customer) {
        throw new BadRequestException('INVALID_CUSTOMER');
      }
      customerCode = customer.code;
    } else if (dto.customerId) {
      throw new BadRequestException('CUSTOMER_ID_NOT_ALLOWED_FOR_INTERNAL_PAYROLL');
    }

    const periodKey = dto.periodStart.slice(0, 7).replace(/-/g, '');
    const cycleCode =
      tenantType === PayrollTenantType.CUSTOMER_MANAGED_PAYROLL && customerCode
        ? `CPAY-${customerCode}-${periodKey}`
        : `PAY-${periodKey}`;
    const exists = await this.prisma.payrollCycle.findFirst({
      where: { organizationId: user.organizationId, cycleCode },
    });
    if (exists) throw new BadRequestException('Cycle for period already exists');

    const cycle = await this.prisma.payrollCycle.create({
      data: {
        organizationId: user.organizationId,
        tenantType,
        customerId:
          tenantType === PayrollTenantType.CUSTOMER_MANAGED_PAYROLL
            ? dto.customerId
            : null,
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
    const rules = resolvePayrollRules(
      ruleVersion.rules as unknown as PayrollRules,
    );

    if (cycle.tenantType === PayrollTenantType.CUSTOMER_MANAGED_PAYROLL) {
      return this.generateCustomerPayslips(cycle, user, rules, ruleVersion.id);
    }

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

      const inputsSnapshot = await this.snapshotPayrollInputs(
        employee,
        Number(salaryAssignment.basicSalary),
        cycle.periodStart,
        cycle.periodEnd,
        rules,
      );

      const allowanceItems: PayslipLineItem[] = [];
      const allowancesRaw = salaryAssignment.allowances as Record<
        string,
        number
      > | null;
      if (allowancesRaw) {
        for (const [code, amount] of Object.entries(allowancesRaw)) {
          if (code === 'SITE') continue;
          allowanceItems.push({
            code,
            label: ALLOWANCE_LABELS[code] ?? code.replace(/_/g, ' '),
            amount,
            type: 'EARNING',
          });
        }
      }

      const siteAmount =
        allowancesRaw?.SITE != null
          ? Number(allowancesRaw.SITE)
          : inputsSnapshot.siteAllowance;
      if (siteAmount > 0) {
        allowanceItems.push({
          code: 'SITE',
          label: inputsSnapshot.siteName
            ? `Site allowance (${inputsSnapshot.siteName})`
            : 'Site allowance',
          amount: siteAmount,
          type: 'EARNING',
        });
      }

      const otherEarnings: PayslipLineItem[] = [];
      if (inputsSnapshot.alertnessBonus > 0) {
        otherEarnings.push({
          code: 'ALERTNESS_BONUS',
          label: `Alertness bonus (${inputsSnapshot.alertnessConfirmed} confirmed)`,
          amount: inputsSnapshot.alertnessBonus,
          type: 'EARNING',
        });
      }

      const otherDeductions: PayslipLineItem[] = [];
      if (inputsSnapshot.alertnessPenalty > 0) {
        otherDeductions.push({
          code: 'ALERTNESS_PENALTY',
          label: `Alertness penalty (${inputsSnapshot.alertnessMissed} missed, ${inputsSnapshot.alertnessLate} late)`,
          amount: inputsSnapshot.alertnessPenalty,
          type: 'DEDUCTION',
        });
      }
      if (inputsSnapshot.unpaidLeaveDeduction > 0) {
        otherDeductions.push({
          code: 'UNPAID_LEAVE',
          label: `Unpaid leave (${inputsSnapshot.unpaidLeaveDays} days)`,
          amount: inputsSnapshot.unpaidLeaveDeduction,
          type: 'DEDUCTION',
        });
      }

      const dueInstallments = await this.loans.getDueInstallmentsForEmployee(
        employee.id,
        user.organizationId,
        cycle.periodEnd,
      );
      const loanDeductions: PayslipLineItem[] = dueInstallments.map((i) => ({
        code: `LOAN-${i.loan.loanNumber}`,
        label: `${i.loan.loanType.replace(/_/g, ' ')} #${i.installmentNumber}`,
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
        otherEarnings,
        otherDeductions,
        rules,
      });

      const allDeductions = calc.lines.filter((l) => l.type === 'DEDUCTION');

      const snapshot = await this.prisma.payslipSnapshot.create({
        data: {
          organizationId: user.organizationId,
          cycleId,
          employeeId: employee.id,
          employeeNumber: employee.employeeNumber,
          employeeName: employee.fullName,
          inputsSnapshot: inputsSnapshot as unknown as Prisma.InputJsonValue,
          allowancesSnapshot: allowanceItems as unknown as Prisma.InputJsonValue,
          deductionsSnapshot: allDeductions as unknown as Prisma.InputJsonValue,
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
    if (cycle.status !== PayrollCycleStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Cycle is not pending approval');
    }
    this.assertNotCreator(cycle.createdBy, user);

    const approval = await this.approvals.act(
      cycle.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    if (approval.status !== 'APPROVED') {
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'payroll.approval_step',
        resourceType: PAYROLL_RESOURCE,
        resourceId: cycleId,
        after: {
          approvalStatus: approval.status,
          currentStepOrder: approval.currentStepOrder,
        },
      });
      return this.toCycleDto(cycle);
    }

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
      resourceType: PAYROLL_RESOURCE,
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

    await this.payrollDue.assertCustomerPayrollPayAllowed(cycle, user);

    const payslips = await this.prisma.payslipSnapshot.findMany({
      where: { cycleId },
    });

    for (const payslip of payslips) {
      if (!payslip.employeeId) continue;
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
        const loanIds = new Set<string>();
        for (const inst of installments) {
          loanIds.add(inst.loanId);
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
        for (const loanId of loanIds) {
          await this.loans.completeIfFullyPaid(
            loanId,
            user.organizationId,
            user.id,
          );
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

  async listCycles(
    organizationId: string,
    filters?: { customerId?: string; tenantType?: PayrollTenantType },
  ): Promise<PayrollCycleResponseDto[]> {
    const rows = await this.prisma.payrollCycle.findMany({
      where: {
        organizationId,
        ...(filters?.customerId ? { customerId: filters.customerId } : {}),
        ...(filters?.tenantType ? { tenantType: filters.tenantType } : {}),
      },
      orderBy: { periodStart: 'desc' },
      take: 24,
    });
    return rows.map((c) => this.toCycleDto(c));
  }

  async listCyclesForCustomerPortal(user: AuthUser) {
    const customerId = this.requirePortalCustomerId(user);
    return this.listCycles(user.organizationId, {
      customerId,
      tenantType: PayrollTenantType.CUSTOMER_MANAGED_PAYROLL,
    });
  }

  async listPayslipsForCustomerPortal(
    cycleId: string,
    user: AuthUser,
  ): Promise<PayslipSnapshotResponseDto[]> {
    const customerId = this.requirePortalCustomerId(user);
    const cycle = await this.getCustomerCycleOrThrow(
      cycleId,
      user.organizationId,
      customerId,
    );
    return this.listPayslips(cycle.id, user.organizationId);
  }

  async getPayslipForCustomerPortal(payslipId: string, user: AuthUser) {
    const customerId = this.requirePortalCustomerId(user);
    const payslip = await this.prisma.payslipSnapshot.findFirst({
      where: { id: payslipId, organizationId: user.organizationId },
      include: { cycle: true },
    });
    if (!payslip?.cycle) throw new NotFoundException('Payslip not found');
    if (
      payslip.cycle.tenantType !== PayrollTenantType.CUSTOMER_MANAGED_PAYROLL ||
      payslip.cycle.customerId !== customerId
    ) {
      throw new NotFoundException('Payslip not found');
    }
    return this.toPayslipDto(payslip);
  }

  async listMyPayslipsForEmployee(user: AuthUser) {
    const customerId = this.requirePortalCustomerId(user);
    const emp = await this.prisma.customerEmployee.findFirst({
      where: { userId: user.id, customerId, organizationId: user.organizationId },
    });
    if (!emp) throw new NotFoundException('Employee profile not linked');

    const payslips = await this.prisma.payslipSnapshot.findMany({
      where: {
        organizationId: user.organizationId,
        customerEmployeeId: emp.id,
        cycle: {
          customerId,
          tenantType: PayrollTenantType.CUSTOMER_MANAGED_PAYROLL,
        },
      },
      include: { cycle: true },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
    return payslips.map((p) => this.toPayslipDto(p));
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

  async getRegister(cycleId: string, organizationId: string) {
    const cycle = await this.getCycleOrThrow(cycleId, organizationId);
    const payslips = await this.prisma.payslipSnapshot.findMany({
      where: { cycleId, organizationId },
      orderBy: { employeeName: 'asc' },
    });
    const rows = payslips.map((p) => ({
      employeeNumber: p.employeeNumber,
      employeeName: p.employeeName,
      grossPay: Number(p.grossPay),
      totalDeductions: Number(p.totalDeductions),
      netPay: Number(p.netPay),
      lines: (p.calculationResult as { lines?: PayslipLineItem[] })?.lines ?? [],
    }));
    const totals = rows.reduce(
      (acc, r) => ({
        grossPay: acc.grossPay + r.grossPay,
        totalDeductions: acc.totalDeductions + r.totalDeductions,
        netPay: acc.netPay + r.netPay,
      }),
      { grossPay: 0, totalDeductions: 0, netPay: 0 },
    );
    await this.audit.record({
      organizationId,
      actorId: null,
      action: 'payroll.register.viewed',
      resourceType: PAYROLL_RESOURCE,
      resourceId: cycleId,
      after: { headcount: rows.length },
    });
    return {
      cycle: this.toCycleDto(cycle),
      headcount: rows.length,
      totals,
      rows,
    };
  }

  async getLoanDeductionReport(cycleId: string, organizationId: string) {
    await this.getCycleOrThrow(cycleId, organizationId);
    const payslips = await this.prisma.payslipSnapshot.findMany({
      where: { cycleId, organizationId },
    });
    const rows: Array<{
      employeeNumber: string;
      employeeName: string;
      loanCode: string;
      label: string;
      amount: number;
    }> = [];
    for (const p of payslips) {
      const lines =
        (p.calculationResult as { lines?: PayslipLineItem[] })?.lines ?? [];
      for (const line of lines) {
        if (line.type === 'DEDUCTION' && line.code.startsWith('LOAN-')) {
          rows.push({
            employeeNumber: p.employeeNumber,
            employeeName: p.employeeName,
            loanCode: line.code,
            label: line.label,
            amount: line.amount,
          });
        }
      }
    }
    return {
      cycleId,
      rowCount: rows.length,
      totalDeductions: rows.reduce((s, r) => s + r.amount, 0),
      rows,
    };
  }

  async getStatutoryReport(cycleId: string, organizationId: string) {
    await this.getCycleOrThrow(cycleId, organizationId);
    const payslips = await this.prisma.payslipSnapshot.findMany({
      where: { cycleId, organizationId },
    });
    let nssfTotal = 0;
    let payeTotal = 0;
    const rows = payslips.map((p) => {
      const lines =
        (p.calculationResult as { lines?: PayslipLineItem[] })?.lines ?? [];
      const nssf = lines.find((l) => l.code === 'NSSF')?.amount ?? 0;
      const paye = lines.find((l) => l.code === 'PAYE')?.amount ?? 0;
      nssfTotal += nssf;
      payeTotal += paye;
      return {
        employeeNumber: p.employeeNumber,
        employeeName: p.employeeName,
        grossPay: Number(p.grossPay),
        nssf,
        paye,
      };
    });
    return {
      cycleId,
      headcount: rows.length,
      nssfTotal,
      payeTotal,
      rows,
      note: 'Simplified flat-rate statutory — full TRA/SDL/WCF deferred',
    };
  }

  async getApprovalReport(cycleId: string, organizationId: string) {
    const cycle = await this.getCycleOrThrow(cycleId, organizationId);
    let approvalSteps: unknown[] = [];
    if (cycle.approvalInstanceId) {
      const instance = await this.prisma.approvalInstance.findFirst({
        where: { id: cycle.approvalInstanceId, organizationId },
        include: {
          actions: { orderBy: { createdAt: 'asc' } },
          version: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
        },
      });
      if (instance) {
        approvalSteps = instance.actions.map((a) => ({
          stepOrder: a.stepOrder,
          decision: a.decision,
          actorId: a.actorId,
          actedAt: a.createdAt,
          remarks: a.remarks,
        }));
      }
    }
    return {
      cycle: this.toCycleDto(cycle),
      approvalInstanceId: cycle.approvalInstanceId,
      createdBy: cycle.createdBy,
      reviewedBy: cycle.reviewedBy,
      approvedBy: cycle.approvedBy,
      paidAt: cycle.paidAt,
      paymentReference: cycle.paymentReference,
      steps: approvalSteps,
    };
  }

  async exportBankFile(cycleId: string, organizationId: string, actorId: string) {
    const cycle = await this.getCycleOrThrow(cycleId, organizationId);
    if (
      cycle.status !== PayrollCycleStatus.APPROVED &&
      cycle.status !== PayrollCycleStatus.PAID
    ) {
      throw new BadRequestException(
        'Bank file only available for approved or paid cycles',
      );
    }
    const payslips = await this.prisma.payslipSnapshot.findMany({
      where: { cycleId, organizationId },
      orderBy: { employeeName: 'asc' },
    });
    const employeeIds = payslips
      .map((p) => p.employeeId)
      .filter((id): id is string => !!id);
    const customerEmployeeIds = payslips
      .map((p) => p.customerEmployeeId)
      .filter((id): id is string => !!id);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        bankAccountRef: true,
        bankName: true,
        employeeNumber: true,
      },
    });
    const customerEmployees = await this.prisma.customerEmployee.findMany({
      where: { id: { in: customerEmployeeIds } },
      select: {
        id: true,
        bankAccountRef: true,
        bankName: true,
      },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));
    const ceMap = new Map(customerEmployees.map((e) => [e.id, e]));
    const rows = payslips.map((p) => {
      const emp = p.employeeId ? empMap.get(p.employeeId) : undefined;
      const ce = p.customerEmployeeId
        ? ceMap.get(p.customerEmployeeId)
        : undefined;
      return {
        employeeNumber: p.employeeNumber,
        employeeName: p.employeeName,
        bankName: emp?.bankName ?? ce?.bankName ?? '',
        bankAccountRef: emp?.bankAccountRef ?? ce?.bankAccountRef ?? '',
        netPay: Number(p.netPay),
        currency: 'TZS',
      };
    });
    const csv = this.toCsv(
      ['employeeNumber', 'employeeName', 'bankName', 'bankAccountRef', 'netPay', 'currency'],
      rows.map((r) => [
        r.employeeNumber,
        r.employeeName,
        r.bankName,
        r.bankAccountRef,
        String(r.netPay),
        r.currency,
      ]),
    );
    await this.audit.record({
      organizationId,
      actorId,
      action: 'payroll.export.bank_file',
      resourceType: PAYROLL_RESOURCE,
      resourceId: cycleId,
      after: { rowCount: rows.length },
    });
    return { filename: `${cycle.cycleCode}-bank.csv`, contentType: 'text/csv', csv, rows };
  }

  async exportMobileMoneyFile(
    cycleId: string,
    organizationId: string,
    actorId: string,
  ) {
    const cycle = await this.getCycleOrThrow(cycleId, organizationId);
    if (
      cycle.status !== PayrollCycleStatus.APPROVED &&
      cycle.status !== PayrollCycleStatus.PAID
    ) {
      throw new BadRequestException(
        'Mobile money file only available for approved or paid cycles',
      );
    }
    const payslips = await this.prisma.payslipSnapshot.findMany({
      where: { cycleId, organizationId },
      orderBy: { employeeName: 'asc' },
    });
    const employeeIds = payslips
      .map((p) => p.employeeId)
      .filter((id): id is string => !!id);
    const customerEmployeeIds = payslips
      .map((p) => p.customerEmployeeId)
      .filter((id): id is string => !!id);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        phone: true,
        mobileMoneyRef: true,
        mobileMoneyProvider: true,
      },
    });
    const customerEmployees = await this.prisma.customerEmployee.findMany({
      where: { id: { in: customerEmployeeIds } },
      select: {
        id: true,
        phone: true,
        mobileMoneyRef: true,
        mobileMoneyProvider: true,
      },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));
    const ceMap = new Map(customerEmployees.map((e) => [e.id, e]));
    const rows = payslips.map((p) => {
      const emp = p.employeeId ? empMap.get(p.employeeId) : undefined;
      const ce = p.customerEmployeeId
        ? ceMap.get(p.customerEmployeeId)
        : undefined;
      return {
        employeeNumber: p.employeeNumber,
        employeeName: p.employeeName,
        provider:
          emp?.mobileMoneyProvider ?? ce?.mobileMoneyProvider ?? 'MOBILE',
        mobileRef:
          emp?.mobileMoneyRef ??
          emp?.phone ??
          ce?.mobileMoneyRef ??
          ce?.phone ??
          '',
        netPay: Number(p.netPay),
        currency: 'TZS',
      };
    });
    const csv = this.toCsv(
      ['employeeNumber', 'employeeName', 'provider', 'mobileRef', 'netPay', 'currency'],
      rows.map((r) => [
        r.employeeNumber,
        r.employeeName,
        r.provider,
        r.mobileRef,
        String(r.netPay),
        r.currency,
      ]),
    );
    await this.audit.record({
      organizationId,
      actorId,
      action: 'payroll.export.mobile_money_file',
      resourceType: PAYROLL_RESOURCE,
      resourceId: cycleId,
      after: { rowCount: rows.length },
    });
    return {
      filename: `${cycle.cycleCode}-mobile.csv`,
      contentType: 'text/csv',
      csv,
      rows,
    };
  }

  private async snapshotPayrollInputs(
    employee: {
      id: string;
      guardProfileId: string | null;
    },
    basicSalary: number,
    periodStart: Date,
    periodEnd: Date,
    rules: PayrollRules,
  ) {
    const attendance = await this.snapshotAttendanceInputs(
      employee,
      periodStart,
      periodEnd,
    );

    let alertnessConfirmed = 0;
    let alertnessLate = 0;
    let alertnessMissed = 0;

    if (employee.guardProfileId) {
      const checks = await this.prisma.alertnessCheck.findMany({
        where: {
          guardId: employee.guardProfileId,
          scheduledAt: { gte: periodStart, lte: periodEnd },
          status: { in: ['CONFIRMED', 'LATE', 'MISSED'] },
        },
      });
      for (const c of checks) {
        if (c.status === 'CONFIRMED') alertnessConfirmed += 1;
        else if (c.status === 'LATE') alertnessLate += 1;
        else if (c.status === 'MISSED') alertnessMissed += 1;
      }
    }

    const confirmBonus = rules.alertnessConfirmBonus ?? 500;
    const missPenalty = rules.alertnessMissPenalty ?? 2000;
    const latePenalty = rules.alertnessLatePenalty ?? 500;
    const alertnessBonus = alertnessConfirmed * confirmBonus;
    const alertnessPenalty =
      alertnessMissed * missPenalty + alertnessLate * latePenalty;

    const unpaidLeaveDays = await this.countUnpaidLeaveDays(
      employee.id,
      periodStart,
      periodEnd,
    );
    const unpaidLeaveDeductionAmount = unpaidLeaveDeduction(
      basicSalary,
      unpaidLeaveDays,
      rules,
    );

    let siteAllowance = 0;
    let siteName: string | null = null;
    if (employee.guardProfileId) {
      const deployment = await this.prisma.guardDeployment.findFirst({
        where: {
          guardId: employee.guardProfileId,
          status: 'ACTIVE',
          startDate: { lte: periodEnd },
          OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
        },
      });
      if (deployment) {
        const site = await this.prisma.site.findFirst({
          where: { id: deployment.siteId },
          select: { code: true, name: true },
        });
        if (site) {
          siteName = site.name ?? site.code;
        }
        siteAllowance = rules.defaultSiteAllowance ?? 0;
      }
    }

    return {
      ...attendance,
      alertnessConfirmed,
      alertnessLate,
      alertnessMissed,
      alertnessBonus,
      alertnessPenalty,
      unpaidLeaveDays,
      unpaidLeaveDeduction: unpaidLeaveDeductionAmount,
      siteAllowance,
      siteName,
    };
  }

  private async countUnpaidLeaveDays(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      include: { leaveType: true },
    });
    let days = 0;
    for (const req of requests) {
      if (req.leaveType.isPaidLeave) continue;
      const overlapStart =
        req.startDate > periodStart ? req.startDate : periodStart;
      const overlapEnd = req.endDate < periodEnd ? req.endDate : periodEnd;
      if (overlapEnd >= overlapStart) {
        const ms = overlapEnd.getTime() - overlapStart.getTime();
        days += Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
      }
    }
    return days;
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
        supervisorApproved: true,
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

  private async generateCustomerPayslips(
    cycle: {
      id: string;
      organizationId: string;
      customerId: string | null;
      periodStart: Date;
      periodEnd: Date;
    },
    user: AuthUser,
    rules: PayrollRules,
    ruleVersionId: string,
  ): Promise<PayslipSnapshotResponseDto[]> {
    if (!cycle.customerId) {
      throw new BadRequestException('CUSTOMER_REQUIRED_FOR_CUSTOMER_PAYROLL');
    }

    const customerEmployees = await this.prisma.customerEmployee.findMany({
      where: {
        organizationId: user.organizationId,
        customerId: cycle.customerId,
        isActive: true,
      },
    });

    const snapshots: PayslipSnapshotResponseDto[] = [];

    for (const ce of customerEmployees) {
      const salaryAssignment =
        await this.customerSalary.getActiveForCustomerEmployee(
          ce.id,
          user.organizationId,
          cycle.periodEnd,
        );
      if (!salaryAssignment) continue;

      const inputsSnapshot = await this.snapshotCustomerAccessInputs(
        ce.id,
        cycle.customerId,
        cycle.periodStart,
        cycle.periodEnd,
      );

      const divisor = rules.dailyRateDivisor ?? 22;
      const absentDeduction =
        inputsSnapshot.absentDays > 0
          ? unpaidLeaveDeduction(
              Number(salaryAssignment.basicSalary),
              inputsSnapshot.absentDays,
              rules,
            )
          : 0;
      inputsSnapshot.absentDeduction = absentDeduction;

      const allowanceItems: PayslipLineItem[] = [];
      const allowancesRaw = salaryAssignment.allowances as Record<
        string,
        number
      > | null;
      if (allowancesRaw) {
        for (const [code, amount] of Object.entries(allowancesRaw)) {
          allowanceItems.push({
            code,
            label: ALLOWANCE_LABELS[code] ?? code.replace(/_/g, ' '),
            amount,
            type: 'EARNING',
          });
        }
      }

      const otherDeductions: PayslipLineItem[] = [];
      const deductionsRaw = salaryAssignment.deductions as Record<
        string,
        number
      > | null;
      if (deductionsRaw) {
        for (const [code, amount] of Object.entries(deductionsRaw)) {
          otherDeductions.push({
            code,
            label: code.replace(/_/g, ' '),
            amount,
            type: 'DEDUCTION',
          });
        }
      }

      if (inputsSnapshot.absentDeduction > 0) {
        otherDeductions.push({
          code: 'ABSENCE',
          label: `Absence deduction (${inputsSnapshot.absentDays} days)`,
          amount: inputsSnapshot.absentDeduction,
          type: 'DEDUCTION',
        });
      }

      const calc = calculatePayslip({
        basicSalary: Number(salaryAssignment.basicSalary),
        hoursWorked: inputsSnapshot.totalHours,
        hourlyRate: salaryAssignment.hourlyRate
          ? Number(salaryAssignment.hourlyRate)
          : undefined,
        allowances: allowanceItems,
        loanDeductions: [],
        otherDeductions,
        rules,
      });

      const allDeductions = calc.lines.filter((l) => l.type === 'DEDUCTION');

      const snapshot = await this.prisma.payslipSnapshot.create({
        data: {
          organizationId: user.organizationId,
          cycleId: cycle.id,
          customerEmployeeId: ce.id,
          employeeNumber: ce.employeeNumber ?? ce.id.slice(0, 8),
          employeeName: ce.fullName,
          inputsSnapshot: {
            ...inputsSnapshot,
            tenantType: PayrollTenantType.CUSTOMER_MANAGED_PAYROLL,
            customerId: cycle.customerId,
          } as unknown as Prisma.InputJsonValue,
          allowancesSnapshot: allowanceItems as unknown as Prisma.InputJsonValue,
          deductionsSnapshot: allDeductions as unknown as Prisma.InputJsonValue,
          calculationResult: calc as unknown as Prisma.InputJsonValue,
          grossPay: new Prisma.Decimal(calc.grossPay),
          totalDeductions: new Prisma.Decimal(calc.totalDeductions),
          netPay: new Prisma.Decimal(calc.netPay),
          ruleVersionId,
          createdBy: user.id,
        },
      });

      snapshots.push(this.toPayslipDto(snapshot));
    }

    await this.prisma.payrollCycle.update({
      where: { id: cycle.id },
      data: {
        status: PayrollCycleStatus.CALCULATED,
        reviewedBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'customer_payroll.generated',
      resourceType: PAYROLL_RESOURCE,
      resourceId: cycle.id,
      after: { payslipCount: snapshots.length, customerId: cycle.customerId },
    });

    return snapshots;
  }

  private async snapshotCustomerAccessInputs(
    customerEmployeeId: string,
    customerId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const entries = await this.prisma.accessEntry.findMany({
      where: {
        customerId,
        employeeId: customerEmployeeId,
        recordedAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { recordedAt: 'asc' },
    });

    const checkInDays = new Set<string>();
    for (const e of entries) {
      if (e.entryType === 'CHECK_IN') {
        checkInDays.add(e.recordedAt.toISOString().slice(0, 10));
      }
    }
    const daysPresent = checkInDays.size;
    const standardDays = 22;
    const absentDays = Math.max(0, standardDays - daysPresent);
    const totalHours = daysPresent * 8;

    return {
      daysPresent,
      absentDays,
      totalHours,
      absentDeduction: 0,
      entryCount: entries.length,
      entries: entries.map((e) => ({
        id: e.id,
        entryType: e.entryType,
        siteId: e.siteId,
        recordedAt: e.recordedAt.toISOString(),
      })),
      snapshottedAt: new Date().toISOString(),
      source: 'access.AccessEntry',
    };
  }

  private requirePortalCustomerId(user: AuthUser): string {
    if (!user.customerId) {
      throw new ForbiddenException('Customer portal scope required');
    }
    return user.customerId;
  }

  private async getCustomerCycleOrThrow(
    cycleId: string,
    organizationId: string,
    customerId: string,
  ) {
    const cycle = await this.prisma.payrollCycle.findFirst({
      where: {
        id: cycleId,
        organizationId,
        customerId,
        tenantType: PayrollTenantType.CUSTOMER_MANAGED_PAYROLL,
      },
    });
    if (!cycle) throw new NotFoundException('Payroll cycle not found');
    return cycle;
  }

  private assertNotCreator(createdBy: string, user: AuthUser) {
    if (createdBy === user.id) {
      throw new ForbiddenException({
        code: 'CREATOR_CANNOT_APPROVE',
        message: 'The officer who created this payroll cycle cannot approve it',
      });
    }
  }

  private toCsv(headers: string[], rows: string[][]): string {
    const escape = (v: string) =>
      v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    return [
      headers.join(','),
      ...rows.map((r) => r.map(escape).join(',')),
    ].join('\n');
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
    billingInvoiceId?: string | null;
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
      billingInvoiceId: c.billingInvoiceId ?? null,
      createdAt: c.createdAt,
    };
  }

  private toPayslipDto(p: {
    id: string;
    organizationId: string;
    cycleId: string;
    employeeId: string | null;
    customerEmployeeId?: string | null;
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
      customerEmployeeId: p.customerEmployeeId ?? null,
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
