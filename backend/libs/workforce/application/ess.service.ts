import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoanStatus, Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import { AssetsService } from '@pssms/assets';
import { FinanceOpsService } from '@pssms/finance';
import { LeaveService } from './leave.service';
import {
  LeaveRequestResponseDto,
  LeaveTypeResponseDto,
} from '../presentation/dto/leave.dto';
import {
  EssApplyLeaveDto,
  EssApplyLoanDto,
  EssApplyPettyCashDto,
  EssEquipmentResponseDto,
  EssPayslipResponseDto,
  EssPettyCashVoucherResponseDto,
  EssProfileResponseDto,
  EssRequestItemDto,
} from '../presentation/dto/ess.dto';

/** Self-scoped Employee Self-Service (§35.5) — resolves Employee by JWT userId. */
@Injectable()
export class EssService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly leave: LeaveService,
    private readonly assets: AssetsService,
    private readonly financeOps: FinanceOpsService,
  ) {}

  async getMe(user: AuthUser): Promise<EssProfileResponseDto> {
    const employee = await this.requireLinkedEmployee(user);
    return {
      id: employee.id,
      organizationId: employee.organizationId,
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      department: employee.department,
      employmentType: employee.employmentType,
      status: employee.status,
      hireDate: employee.hireDate,
      guardProfileId: employee.guardProfileId,
    };
  }

  async listLeaveTypes(user: AuthUser): Promise<LeaveTypeResponseDto[]> {
    await this.requireLinkedEmployee(user);
    return this.leave.listLeaveTypes(user.organizationId);
  }

  async listMyLeave(user: AuthUser): Promise<LeaveRequestResponseDto[]> {
    const employee = await this.requireLinkedEmployee(user);
    return this.leave.listLeaveRequests(user.organizationId, employee.id);
  }

  async applyLeave(
    dto: EssApplyLeaveDto,
    user: AuthUser,
  ): Promise<LeaveRequestResponseDto> {
    const employee = await this.requireLinkedEmployee(user);
    return this.leave.applyLeave(
      {
        employeeId: employee.id,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        days: dto.days,
        reason: dto.reason,
      },
      user,
    );
  }

  async listMyPayslips(user: AuthUser): Promise<EssPayslipResponseDto[]> {
    const employee = await this.requireLinkedEmployee(user);
    const rows = await this.prisma.payslipSnapshot.findMany({
      where: {
        organizationId: user.organizationId,
        employeeId: employee.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 48,
    });
    return rows.map((p) => ({
      id: p.id,
      cycleId: p.cycleId,
      employeeId: p.employeeId,
      employeeNumber: p.employeeNumber,
      employeeName: p.employeeName,
      grossPay: Number(p.grossPay),
      totalDeductions: Number(p.totalDeductions),
      netPay: Number(p.netPay),
      createdAt: p.createdAt,
      inputsSnapshot: p.inputsSnapshot,
      allowancesSnapshot: p.allowancesSnapshot,
      deductionsSnapshot: p.deductionsSnapshot,
      calculationResult: p.calculationResult,
    }));
  }

  async getMyPayslip(
    id: string,
    user: AuthUser,
  ): Promise<EssPayslipResponseDto> {
    const employee = await this.requireLinkedEmployee(user);
    const p = await this.prisma.payslipSnapshot.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        employeeId: employee.id,
      },
    });
    if (!p) throw new NotFoundException('Payslip not found');
    return {
      id: p.id,
      cycleId: p.cycleId,
      employeeId: p.employeeId,
      employeeNumber: p.employeeNumber,
      employeeName: p.employeeName,
      grossPay: Number(p.grossPay),
      totalDeductions: Number(p.totalDeductions),
      netPay: Number(p.netPay),
      createdAt: p.createdAt,
      inputsSnapshot: p.inputsSnapshot,
      allowancesSnapshot: p.allowancesSnapshot,
      deductionsSnapshot: p.deductionsSnapshot,
      calculationResult: p.calculationResult,
    };
  }

  async listMyLoans(user: AuthUser) {
    const employee = await this.requireLinkedEmployee(user);
    const rows = await this.prisma.employeeLoan.findMany({
      where: {
        organizationId: user.organizationId,
        employeeId: employee.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((l) => ({
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
    }));
  }

  async applyLoan(dto: EssApplyLoanDto, user: AuthUser) {
    const employee = await this.requireLinkedEmployee(user);

    const loanNumber = await this.nextLoanNumber(user.organizationId);
    const monthlyInstallment = round2(dto.principalAmount / dto.termMonths);

    const loan = await this.prisma.employeeLoan.create({
      data: {
        organizationId: user.organizationId,
        employeeId: employee.id,
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
      after: { ...updated, channel: 'ess' },
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      employeeId: updated.employeeId,
      loanNumber: updated.loanNumber,
      principalAmount: Number(updated.principalAmount),
      interestRate: Number(updated.interestRate),
      termMonths: updated.termMonths,
      monthlyInstallment: Number(updated.monthlyInstallment),
      status: updated.status,
      purpose: updated.purpose,
      approvalInstanceId: updated.approvalInstanceId,
      approvedBy: updated.approvedBy,
      approvedAt: updated.approvedAt,
      disbursedAt: updated.disbursedAt,
      createdAt: updated.createdAt,
    };
  }

  async listMyEquipment(user: AuthUser): Promise<EssEquipmentResponseDto[]> {
    const employee = await this.requireLinkedEmployee(user);
    const rows = await this.prisma.assetAssignment.findMany({
      where: {
        organizationId: user.organizationId,
        returnedAt: null,
        OR: [
          { assignedToEmployeeId: employee.id },
          ...(employee.guardProfileId
            ? [{ assignedToGuardId: employee.guardProfileId }]
            : []),
        ],
      },
      include: { asset: true },
      orderBy: { assignedAt: 'desc' },
      take: 50,
    });
    return rows.map((a) => this.toEquipmentDto(a, a.asset));
  }

  async listMyPettyCash(
    user: AuthUser,
  ): Promise<EssPettyCashVoucherResponseDto[]> {
    await this.requireLinkedEmployee(user);
    return this.financeOps.listMyPettyCashVouchers(user);
  }

  async applyPettyCash(
    dto: EssApplyPettyCashDto,
    user: AuthUser,
  ): Promise<EssPettyCashVoucherResponseDto> {
    await this.requireLinkedEmployee(user);
    return this.financeOps.createEssPettyCashVoucher(dto, user);
  }

  /**
   * Thin ESS "Requests" inbox — own leave + loans + movements + petty cash.
   * Does not approve (creator ≠ approver stays on Finance/Approvals).
   */
  async listMyRequests(user: AuthUser): Promise<EssRequestItemDto[]> {
    const employee = await this.requireLinkedEmployee(user);

    const [leaveRows, loanRows, movementRows, pettyRows] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: {
          organizationId: user.organizationId,
          employeeId: employee.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.employeeLoan.findMany({
        where: {
          organizationId: user.organizationId,
          employeeId: employee.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.employeeMovement.findMany({
        where: {
          organizationId: user.organizationId,
          employeeId: employee.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.financeOps.listMyPettyCashVouchers(user),
    ]);

    const items: EssRequestItemDto[] = [
      ...leaveRows.map((r) => ({
        kind: 'LEAVE' as const,
        id: r.id,
        title: `Leave · ${r.days} day(s)`,
        status: r.status,
        createdAt: r.createdAt,
        detail: r.reason,
        href: '/ess/leave',
      })),
      ...loanRows.map((r) => ({
        kind: 'LOAN' as const,
        id: r.id,
        title: `Loan ${r.loanNumber}`,
        status: r.status,
        createdAt: r.createdAt,
        detail: r.purpose,
        href: '/ess/loans',
      })),
      ...movementRows.map((r) => ({
        kind: 'MOVEMENT' as const,
        id: r.id,
        title: `${r.type}`,
        status: r.status,
        createdAt: r.createdAt,
        detail: r.reason,
        href: '/ess/requests',
      })),
      ...pettyRows.map((r) => ({
        kind: 'PETTY_CASH' as const,
        id: r.id,
        title: `Petty cash ${r.voucherNumber}`,
        status: r.status,
        createdAt: new Date(r.createdAt),
        detail: r.purpose,
        href: '/ess/petty-cash',
      })),
    ];

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items.slice(0, 60);
  }

  /**
   * ESS requests return only — storekeeper confirms via assets.confirmReturn.
   * Ownership check here; mutation + audit via AssetsService (module port).
   */
  async returnMyEquipment(
    assignmentId: string,
    user: AuthUser,
  ): Promise<EssEquipmentResponseDto> {
    const employee = await this.requireLinkedEmployee(user);

    const owned = await this.prisma.assetAssignment.findFirst({
      where: {
        id: assignmentId,
        organizationId: user.organizationId,
        returnedAt: null,
        OR: [
          { assignedToEmployeeId: employee.id },
          ...(employee.guardProfileId
            ? [{ assignedToGuardId: employee.guardProfileId }]
            : []),
        ],
      },
      select: { id: true },
    });
    if (!owned) {
      throw new NotFoundException(
        'Active assignment not found for your profile',
      );
    }

    const result = await this.assets.requestReturn(assignmentId, user);
    return this.toEquipmentDto(result.assignment, result.asset);
  }

  private toEquipmentDto(
    a: {
      id: string;
      assetId: string;
      assignedAt: Date;
      notes: string | null;
      returnRequestedAt?: Date | null;
    },
    asset: {
      assetTag: string;
      name: string;
      category: string | null;
    },
  ): EssEquipmentResponseDto {
    const requested = !!a.returnRequestedAt;
    return {
      assignmentId: a.id,
      assetId: a.assetId,
      assetTag: asset.assetTag,
      name: asset.name,
      category: asset.category,
      assignedAt: a.assignedAt,
      notes: a.notes,
      status: requested ? 'RETURN_REQUESTED' : 'ASSIGNED',
      returnRequestedAt: a.returnRequestedAt ?? null,
    };
  }

  private async requireLinkedEmployee(user: AuthUser) {
    const matches = await this.prisma.employee.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      take: 2,
    });
    if (matches.length === 0) {
      throw new NotFoundException({
        error: 'ESS_PROFILE_MISSING',
        message:
          'No employee profile is linked to this user. Ask HR to link your account.',
      });
    }
    if (matches.length > 1) {
      throw new NotFoundException({
        error: 'ESS_PROFILE_AMBIGUOUS',
        message:
          'Multiple employee profiles are linked to this user. Ask HR to fix the link.',
      });
    }
    return matches[0];
  }

  private async nextLoanNumber(organizationId: string): Promise<string> {
    const count = await this.prisma.employeeLoan.count({
      where: { organizationId },
    });
    return `LN-${String(count + 1).padStart(5, '0')}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
