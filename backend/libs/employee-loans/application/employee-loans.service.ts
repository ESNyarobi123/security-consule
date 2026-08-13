import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InstallmentStatus,
  LoanStatus,
  LoanType,
  Prisma,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import { EmployeesService } from '@pssms/workforce';
import {
  ApplyLoanDto,
  ApproveLoanResponseDto,
  EmployeeLoanResponseDto,
  IssueLoanDto,
  IssueLoanResponseDto,
  ITEM_LOAN_TYPES,
  LoanInstallmentResponseDto,
  LoanStatementResponseDto,
  LoanTypeOptionDto,
  RejectLoanDto,
} from '../presentation/dto/loan.dto';

const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  [LoanType.SECURITY_BOOTS]: 'Security boots loan',
  [LoanType.SMARTPHONE]: 'Smartphone loan',
  [LoanType.CASH]: 'Cash / money loan',
  [LoanType.UNIFORM]: 'Uniform loan',
  [LoanType.EMERGENCY]: 'Emergency loan',
  [LoanType.SALARY_ADVANCE]: 'Salary advance',
  [LoanType.EQUIPMENT]: 'Equipment loan',
  [LoanType.TRANSPORT_SUPPORT]: 'Transport support loan',
  [LoanType.MEDICAL_SUPPORT]: 'Medical support loan',
  [LoanType.OTHER]: 'Other approved support loan',
};

@Injectable()
export class EmployeeLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly employees: EmployeesService,
  ) {}

  listTypeOptions(): LoanTypeOptionDto[] {
    return Object.values(LoanType).map((value) => ({
      value,
      label: LOAN_TYPE_LABELS[value],
      isItemLoan: ITEM_LOAN_TYPES.includes(value),
    }));
  }

  async apply(dto: ApplyLoanDto, user: AuthUser): Promise<EmployeeLoanResponseDto> {
    await this.employees.getById(dto.employeeId, user.organizationId);
    this.assertApplyPayload(dto);

    const loanNumber = await this.nextLoanNumber(user.organizationId);
    const monthlyInstallment = round2(dto.principalAmount / dto.termMonths);

    const loan = await this.prisma.employeeLoan.create({
      data: {
        organizationId: user.organizationId,
        employeeId: dto.employeeId,
        loanNumber,
        loanType: dto.loanType,
        principalAmount: new Prisma.Decimal(dto.principalAmount),
        interestRate: new Prisma.Decimal(dto.interestRate ?? 0),
        termMonths: dto.termMonths,
        monthlyInstallment: new Prisma.Decimal(monthlyInstallment),
        purpose: dto.purpose?.trim() || null,
        itemName: dto.itemName?.trim() || null,
        status: LoanStatus.PENDING_APPROVAL,
        createdBy: user.id,
      },
    });

    const approval = await this.approvals.start(
      {
        workflowCode: 'loan-approval',
        resourceType: 'EmployeeLoan',
        resourceId: loan.id,
        amount: dto.principalAmount,
      },
      user,
    );

    const updated = await this.prisma.employeeLoan.update({
      where: { id: loan.id },
      data: { approvalInstanceId: approval.id },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'loan.applied',
      resourceType: 'EmployeeLoan',
      resourceId: loan.id,
      after: updated,
    });

    return this.toLoanDto(updated);
  }

  async approve(id: string, user: AuthUser): Promise<ApproveLoanResponseDto> {
    const loan = await this.findPendingOrThrow(id, user.organizationId);
    if (!loan.approvalInstanceId) {
      throw new BadRequestException('No approval instance');
    }

    const approval = await this.approvals.act(
      loan.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    if (approval.status !== 'APPROVED') {
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'loan.approval_step',
        resourceType: 'EmployeeLoan',
        resourceId: id,
        after: {
          approvalStatus: approval.status,
          currentStepOrder: approval.currentStepOrder,
        },
      });
      return { loan: this.toLoanDto(loan), installments: [] };
    }

    const updated = await this.prisma.employeeLoan.update({
      where: { id },
      data: {
        status: LoanStatus.APPROVED,
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'loan.approved',
      resourceType: 'EmployeeLoan',
      resourceId: id,
      after: { loan: updated, note: 'Awaiting issue/disbursement' },
    });

    return { loan: this.toLoanDto(updated), installments: [] };
  }

  async issue(
    id: string,
    dto: IssueLoanDto,
    user: AuthUser,
  ): Promise<IssueLoanResponseDto> {
    const loan = await this.prisma.employeeLoan.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== LoanStatus.APPROVED) {
      throw new BadRequestException({
        error: 'LOAN_NOT_ISSUABLE',
        message: 'Only APPROVED loans can be issued',
      });
    }
    if (loan.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_ISSUE',
        message: 'The officer who created this loan cannot issue it',
      });
    }

    const isItem = ITEM_LOAN_TYPES.includes(loan.loanType);
    const itemName =
      dto.itemName?.trim() || loan.itemName?.trim() || null;
    if (isItem && !itemName) {
      throw new BadRequestException({
        error: 'ITEM_NAME_REQUIRED',
        message: 'Item name is required for item loans at issue',
      });
    }

    const issuedAt = dto.issueDate
      ? new Date(dto.issueDate)
      : new Date();
    if (Number.isNaN(issuedAt.getTime())) {
      throw new BadRequestException('Invalid issueDate');
    }

    const updated = await this.prisma.employeeLoan.update({
      where: { id },
      data: {
        status: LoanStatus.ACTIVE,
        issuedBy: user.id,
        issuedAt,
        disbursedAt: issuedAt,
        itemName: isItem ? itemName : loan.itemName,
        supplierName:
          dto.supplierName?.trim() || loan.supplierName?.trim() || null,
        itemCost:
          dto.itemCost != null
            ? new Prisma.Decimal(dto.itemCost)
            : loan.itemCost,
        employeeAcknowledgedAt: dto.employeeAcknowledged
          ? issuedAt
          : loan.employeeAcknowledgedAt,
      },
    });

    const installments = await this.generateInstallments(updated);

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'loan.issued',
      resourceType: 'EmployeeLoan',
      resourceId: id,
      after: {
        loan: updated,
        installments: installments.length,
        itemName: updated.itemName,
        supplierName: updated.supplierName,
      },
    });

    return {
      loan: this.toLoanDto(updated),
      installments: installments.map((i) => this.toInstallmentDto(i)),
    };
  }

  async acknowledge(
    id: string,
    user: AuthUser,
    employeeId: string,
  ): Promise<EmployeeLoanResponseDto> {
    const loan = await this.prisma.employeeLoan.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        employeeId,
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE loans can be acknowledged');
    }
    if (!ITEM_LOAN_TYPES.includes(loan.loanType)) {
      throw new BadRequestException('Acknowledgement applies to item loans only');
    }
    if (loan.employeeAcknowledgedAt) {
      return this.toLoanDto(loan);
    }

    const updated = await this.prisma.employeeLoan.update({
      where: { id },
      data: { employeeAcknowledgedAt: new Date() },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'loan.acknowledged',
      resourceType: 'EmployeeLoan',
      resourceId: id,
      after: { employeeAcknowledgedAt: updated.employeeAcknowledgedAt },
    });

    return this.toLoanDto(updated);
  }

  async reject(
    id: string,
    dto: RejectLoanDto,
    user: AuthUser,
  ): Promise<EmployeeLoanResponseDto> {
    const loan = await this.findPendingOrThrow(id, user.organizationId);

    if (loan.approvalInstanceId) {
      await this.approvals.act(
        loan.approvalInstanceId,
        { decision: 'REJECT', remarks: dto.reason },
        user,
      );
    }

    const updated = await this.prisma.employeeLoan.update({
      where: { id },
      data: { status: LoanStatus.REJECTED },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'loan.rejected',
      resourceType: 'EmployeeLoan',
      resourceId: id,
      after: { ...updated, rejectedReason: dto.reason },
    });

    return this.toLoanDto(updated);
  }

  async getStatement(
    id: string,
    organizationId: string,
    employeeId?: string,
  ): Promise<LoanStatementResponseDto> {
    const loan = await this.prisma.employeeLoan.findFirst({
      where: {
        id,
        organizationId,
        ...(employeeId ? { employeeId } : {}),
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');

    const installments = await this.prisma.loanInstallment.findMany({
      where: { loanId: id },
      orderBy: { installmentNumber: 'asc' },
    });

    const totalDue = round2(
      installments.reduce((sum, i) => sum + Number(i.amountDue), 0),
    );
    const totalPaid = round2(
      installments.reduce((sum, i) => sum + Number(i.amountPaid), 0),
    );
    const outstandingBalance = round2(Math.max(0, totalDue - totalPaid));

    return {
      loan: this.toLoanDto(loan, outstandingBalance),
      installments: installments.map((i) => this.toInstallmentDto(i)),
      totalDue,
      totalPaid,
      outstandingBalance,
      isSettled:
        loan.status === LoanStatus.COMPLETED || outstandingBalance <= 0,
    };
  }

  /** Called after payroll marks installments paid — completes loan when fully repaid. */
  async completeIfFullyPaid(
    loanId: string,
    organizationId: string,
    clearedBy?: string,
  ): Promise<void> {
    const loan = await this.prisma.employeeLoan.findFirst({
      where: { id: loanId, organizationId, status: LoanStatus.ACTIVE },
    });
    if (!loan) return;

    const unpaid = await this.prisma.loanInstallment.count({
      where: {
        loanId,
        status: { not: InstallmentStatus.PAID },
      },
    });
    if (unpaid > 0) return;

    const settledAt = new Date();
    await this.prisma.employeeLoan.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.COMPLETED,
        settledAt,
        clearedBy: clearedBy ?? null,
      },
    });

    await this.audit.record({
      organizationId,
      actorId: clearedBy ?? null,
      action: 'loan.settled',
      resourceType: 'EmployeeLoan',
      resourceId: loanId,
      after: { settledAt, status: LoanStatus.COMPLETED },
    });
  }

  async listEmployeeOptions(organizationId: string) {
    const rows = await this.prisma.employee.findMany({
      where: {
        organizationId,
        status: { not: 'TERMINATED' },
      },
      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        department: true,
      },
      orderBy: { fullName: 'asc' },
      take: 300,
    });
    return rows;
  }

  async listLoans(
    organizationId: string,
    employeeId?: string,
  ): Promise<EmployeeLoanResponseDto[]> {
    const rows = await this.prisma.employeeLoan.findMany({
      where: {
        organizationId,
        ...(employeeId ? { employeeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      rows.map(async (l) => {
        const balance = await this.outstandingForLoan(l.id, l.status);
        return this.toLoanDto(l, balance);
      }),
    );
  }

  async listInstallments(
    loanId: string,
    organizationId: string,
  ): Promise<LoanInstallmentResponseDto[]> {
    const loan = await this.prisma.employeeLoan.findFirst({
      where: { id: loanId, organizationId },
    });
    if (!loan) throw new NotFoundException('Loan not found');

    const rows = await this.prisma.loanInstallment.findMany({
      where: { loanId },
      orderBy: { installmentNumber: 'asc' },
    });
    return rows.map((i) => this.toInstallmentDto(i));
  }

  async getDueInstallmentsForEmployee(
    employeeId: string,
    organizationId: string,
    periodEnd: Date,
  ) {
    return this.prisma.loanInstallment.findMany({
      where: {
        status: InstallmentStatus.PENDING,
        dueDate: { lte: periodEnd },
        loan: {
          employeeId,
          organizationId,
          status: LoanStatus.ACTIVE,
        },
      },
      include: { loan: true },
    });
  }

  private assertApplyPayload(dto: ApplyLoanDto) {
    if (ITEM_LOAN_TYPES.includes(dto.loanType)) {
      if (!dto.itemName?.trim()) {
        throw new BadRequestException({
          error: 'ITEM_NAME_REQUIRED',
          message: 'itemName is required for item-based loan types',
        });
      }
    }
  }

  private async findPendingOrThrow(id: string, organizationId: string) {
    const loan = await this.prisma.employeeLoan.findFirst({
      where: { id, organizationId },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== LoanStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Only loans pending approval can be acted on',
      );
    }
    return loan;
  }

  private async outstandingForLoan(
    loanId: string,
    status: LoanStatus,
  ): Promise<number | null> {
    if (
      status !== LoanStatus.ACTIVE &&
      status !== LoanStatus.COMPLETED &&
      status !== LoanStatus.APPROVED
    ) {
      return null;
    }
    const installments = await this.prisma.loanInstallment.findMany({
      where: { loanId },
      select: { amountDue: true, amountPaid: true },
    });
    if (!installments.length) return null;
    const due = installments.reduce((s, i) => s + Number(i.amountDue), 0);
    const paid = installments.reduce((s, i) => s + Number(i.amountPaid), 0);
    return round2(Math.max(0, due - paid));
  }

  private async generateInstallments(loan: {
    id: string;
    termMonths: number;
    monthlyInstallment: Prisma.Decimal;
  }) {
    const installments = [];
    const base = new Date();
    base.setDate(1);
    for (let n = 1; n <= loan.termMonths; n++) {
      const due = new Date(base);
      due.setMonth(due.getMonth() + n);
      installments.push(
        await this.prisma.loanInstallment.create({
          data: {
            loanId: loan.id,
            installmentNumber: n,
            dueDate: due,
            amountDue: loan.monthlyInstallment,
          },
        }),
      );
    }
    return installments;
  }

  private async nextLoanNumber(organizationId: string): Promise<string> {
    const count = await this.prisma.employeeLoan.count({
      where: { organizationId },
    });
    return `LN-${String(count + 1).padStart(5, '0')}`;
  }

  private toLoanDto(
    l: {
      id: string;
      organizationId: string;
      employeeId: string;
      loanNumber: string;
      loanType: LoanType;
      principalAmount: Prisma.Decimal;
      interestRate: Prisma.Decimal;
      termMonths: number;
      monthlyInstallment: Prisma.Decimal;
      status: LoanStatus;
      purpose: string | null;
      itemName?: string | null;
      supplierName?: string | null;
      itemCost?: Prisma.Decimal | null;
      approvalInstanceId: string | null;
      createdBy: string | null;
      approvedBy: string | null;
      approvedAt: Date | null;
      issuedBy?: string | null;
      issuedAt?: Date | null;
      employeeAcknowledgedAt?: Date | null;
      disbursedAt: Date | null;
      settledAt?: Date | null;
      clearedBy?: string | null;
      createdAt: Date;
    },
    outstandingBalance?: number | null,
  ): EmployeeLoanResponseDto {
    return {
      id: l.id,
      organizationId: l.organizationId,
      employeeId: l.employeeId,
      loanNumber: l.loanNumber,
      loanType: l.loanType,
      principalAmount: Number(l.principalAmount),
      interestRate: Number(l.interestRate),
      termMonths: l.termMonths,
      monthlyInstallment: Number(l.monthlyInstallment),
      status: l.status,
      purpose: l.purpose,
      itemName: l.itemName ?? null,
      supplierName: l.supplierName ?? null,
      itemCost: l.itemCost != null ? Number(l.itemCost) : null,
      approvalInstanceId: l.approvalInstanceId,
      createdBy: l.createdBy,
      approvedBy: l.approvedBy,
      approvedAt: l.approvedAt,
      issuedBy: l.issuedBy ?? null,
      issuedAt: l.issuedAt ?? null,
      employeeAcknowledgedAt: l.employeeAcknowledgedAt ?? null,
      disbursedAt: l.disbursedAt,
      settledAt: l.settledAt ?? null,
      clearedBy: l.clearedBy ?? null,
      createdAt: l.createdAt,
      outstandingBalance: outstandingBalance ?? null,
    };
  }

  private toInstallmentDto(i: {
    id: string;
    loanId: string;
    installmentNumber: number;
    dueDate: Date;
    amountDue: Prisma.Decimal;
    amountPaid: Prisma.Decimal;
    status: InstallmentStatus;
    payslipSnapshotId: string | null;
    paidAt: Date | null;
  }): LoanInstallmentResponseDto {
    return {
      id: i.id,
      loanId: i.loanId,
      installmentNumber: i.installmentNumber,
      dueDate: i.dueDate,
      amountDue: Number(i.amountDue),
      amountPaid: Number(i.amountPaid),
      status: i.status,
      payslipSnapshotId: i.payslipSnapshotId,
      paidAt: i.paidAt,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
