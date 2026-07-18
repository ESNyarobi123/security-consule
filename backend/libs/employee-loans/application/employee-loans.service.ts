import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InstallmentStatus,
  LoanStatus,
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
  LoanInstallmentResponseDto,
} from '../presentation/dto/loan.dto';

@Injectable()
export class EmployeeLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly employees: EmployeesService,
  ) {}

  async apply(dto: ApplyLoanDto, user: AuthUser): Promise<EmployeeLoanResponseDto> {
    await this.employees.getById(dto.employeeId, user.organizationId);

    const loanNumber = await this.nextLoanNumber(user.organizationId);
    const monthlyInstallment = round2(dto.principalAmount / dto.termMonths);

    const loan = await this.prisma.employeeLoan.create({
      data: {
        organizationId: user.organizationId,
        employeeId: dto.employeeId,
        loanNumber,
        principalAmount: new Prisma.Decimal(dto.principalAmount),
        interestRate: new Prisma.Decimal(dto.interestRate ?? 0),
        termMonths: dto.termMonths,
        monthlyInstallment: new Prisma.Decimal(monthlyInstallment),
        purpose: dto.purpose,
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
    const loan = await this.prisma.employeeLoan.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (!loan.approvalInstanceId) {
      throw new BadRequestException('No approval instance');
    }

    await this.approvals.act(
      loan.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    const updated = await this.prisma.employeeLoan.update({
      where: { id },
      data: {
        status: LoanStatus.ACTIVE,
        approvedBy: user.id,
        approvedAt: new Date(),
        disbursedAt: new Date(),
      },
    });

    const installments = await this.generateInstallments(updated);

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'loan.approved',
      resourceType: 'EmployeeLoan',
      resourceId: id,
      after: { loan: updated, installments: installments.length },
    });

    return {
      loan: this.toLoanDto(updated),
      installments: installments.map((i) => this.toInstallmentDto(i)),
    };
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
    return rows.map((l) => this.toLoanDto(l));
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

  private toLoanDto(l: {
    id: string;
    organizationId: string;
    employeeId: string;
    loanNumber: string;
    principalAmount: Prisma.Decimal;
    interestRate: Prisma.Decimal;
    termMonths: number;
    monthlyInstallment: Prisma.Decimal;
    status: LoanStatus;
    purpose: string;
    approvalInstanceId: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    disbursedAt: Date | null;
    createdAt: Date;
  }): EmployeeLoanResponseDto {
    return {
      id: l.id,
      organizationId: l.organizationId,
      employeeId: l.employeeId,
      loanNumber: l.loanNumber,
      principalAmount: Number(l.principalAmount),
      interestRate: Number(l.interestRate),
      termMonths: l.termMonths,
      monthlyInstallment: Number(l.monthlyInstallment),
      status: l.status,
      purpose: l.purpose,
      approvalInstanceId: l.approvalInstanceId,
      approvedBy: l.approvedBy,
      approvedAt: l.approvedAt,
      disbursedAt: l.disbursedAt,
      createdAt: l.createdAt,
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
