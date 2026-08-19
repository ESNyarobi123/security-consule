import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, LeaveRequestStatus, LoanStatus, LoanType, Prisma } from '@prisma/client';
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
  EssApprovalItemDto,
  EssAttendancePackDto,
  EssEquipmentResponseDto,
  EssLeaveBalanceDto,
  EssLoanBalanceDto,
  EssNoticeDto,
  EssPayslipResponseDto,
  EssPettyCashVoucherResponseDto,
  EssProfileResponseDto,
  EssRequestItemDto,
  EssTrainingRowDto,
} from '../presentation/dto/ess.dto';

const ESS_ITEM_LOAN_TYPES: LoanType[] = [
  LoanType.SECURITY_BOOTS,
  LoanType.SMARTPHONE,
  LoanType.UNIFORM,
  LoanType.EQUIPMENT,
];
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

  async listLeaveBalances(user: AuthUser): Promise<EssLeaveBalanceDto[]> {
    const employee = await this.requireLinkedEmployee(user);
    const year = new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const types = await this.prisma.leaveType.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        organizationId: user.organizationId,
        employeeId: employee.id,
        startDate: { gte: yearStart, lt: yearEnd },
        status: {
          in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED],
        },
      },
    });
    return types.map((t) => {
      const mine = requests.filter((r) => r.leaveTypeId === t.id);
      const usedDays = mine
        .filter((r) => r.status === LeaveRequestStatus.APPROVED)
        .reduce((s, r) => s + r.days, 0);
      const pendingDays = mine
        .filter((r) => r.status === LeaveRequestStatus.PENDING)
        .reduce((s, r) => s + r.days, 0);
      return {
        leaveTypeId: t.id,
        code: t.code,
        name: t.name,
        annualQuotaDays: t.annualQuotaDays,
        usedDays,
        pendingDays,
        remainingDays: Math.max(0, t.annualQuotaDays - usedDays - pendingDays),
        year,
      };
    });
  }

  async getLoanBalance(user: AuthUser): Promise<EssLoanBalanceDto> {
    const employee = await this.requireLinkedEmployee(user);
    const loans = await this.prisma.employeeLoan.findMany({
      where: {
        organizationId: user.organizationId,
        employeeId: employee.id,
      },
      include: { installments: true },
    });
    let outstandingBalance = 0;
    let activeLoanCount = 0;
    let pendingLoanCount = 0;
    for (const loan of loans) {
      if (loan.status === LoanStatus.PENDING_APPROVAL) {
        pendingLoanCount += 1;
        continue;
      }
      if (
        loan.status === LoanStatus.COMPLETED ||
        loan.status === LoanStatus.REJECTED ||
        loan.status === LoanStatus.CANCELLED
      ) {
        continue;
      }
      if (
        loan.status === LoanStatus.ACTIVE ||
        loan.status === LoanStatus.APPROVED
      ) {
        activeLoanCount += 1;
        if (loan.installments.length > 0) {
          const due = loan.installments.reduce(
            (s, i) => s + Number(i.amountDue),
            0,
          );
          const paid = loan.installments.reduce(
            (s, i) => s + Number(i.amountPaid),
            0,
          );
          outstandingBalance += Math.max(0, due - paid);
        } else {
          outstandingBalance += Number(loan.principalAmount);
        }
      }
    }
    return {
      outstandingBalance: round2(outstandingBalance),
      activeLoanCount,
      pendingLoanCount,
    };
  }

  async listMyAttendance(user: AuthUser): Promise<EssAttendancePackDto> {
    const employee = await this.requireLinkedEmployee(user);
    if (!employee.guardProfileId) {
      return {
        source: 'NONE',
        note: 'Office attendance is not on this portal. Guard clock-in appears here when HR links a guard profile.',
        rows: [],
      };
    }
    const rows = await this.prisma.guardAttendance.findMany({
      where: {
        organizationId: user.organizationId,
        guardId: employee.guardProfileId,
      },
      orderBy: { clockInAt: 'desc' },
      take: 40,
    });
    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites = siteIds.length
      ? await this.prisma.site.findMany({
          where: { organizationId: user.organizationId, id: { in: siteIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const siteMap = new Map(sites.map((s) => [s.id, s]));
    return {
      source: 'GUARD',
      note: 'Your guard clock-in / clock-out (last 40). Field punch stays on the Guard app.',
      rows: rows.map((r) => {
        const site = siteMap.get(r.siteId);
        return {
          id: r.id,
          siteId: r.siteId,
          siteCode: site?.code ?? null,
          siteName: site?.name ?? null,
          clockInAt: r.clockInAt,
          clockOutAt: r.clockOutAt,
          clockInMethod: r.clockInMethod,
          supervisorApproved: r.supervisorApproved,
        };
      }),
    };
  }

  async listMyTraining(user: AuthUser): Promise<EssTrainingRowDto[]> {
    const employee = await this.requireLinkedEmployee(user);
    const rows = await this.prisma.trainingRecord.findMany({
      where: {
        organizationId: user.organizationId,
        employeeId: employee.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      provider: r.provider,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      notes: r.notes,
    }));
  }

  async listMyNotices(user: AuthUser): Promise<EssNoticeDto[]> {
    const employee = await this.requireLinkedEmployee(user);
    const recipients = [
      ...new Set(
        [user.email, employee.email, employee.phone].filter(
          (v): v is string => Boolean(v && v.trim()),
        ),
      ),
    ];
    if (recipients.length === 0) return [];
    const rows = await this.prisma.notification.findMany({
      where: {
        organizationId: user.organizationId,
        recipient: { in: recipients },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return rows.map((r) => ({
      id: r.id,
      templateCode: r.templateCode,
      channel: r.channel,
      subject: r.subject,
      body: r.body,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async listMyApprovals(user: AuthUser): Promise<EssApprovalItemDto[]> {
    await this.requireLinkedEmployee(user);
    const mine = await this.prisma.approvalInstance.findMany({
      where: {
        organizationId: user.organizationId,
        createdBy: user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        version: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
    });
    const items: EssApprovalItemDto[] = mine.map((i) => {
      const step = i.version.steps.find(
        (s) => s.stepOrder === i.currentStepOrder,
      );
      return {
        id: i.id,
        resourceType: i.resourceType,
        resourceId: i.resourceId,
        status: i.status,
        mine: true,
        currentStepName: i.status === ApprovalStatus.PENDING ? (step?.name ?? null) : null,
        requiredRole:
          i.status === ApprovalStatus.PENDING ? (step?.requiredRole ?? null) : null,
        createdAt: i.createdAt,
      };
    });

    if (user.permissions.includes('approvals.act')) {
      const isSuperAdmin = user.roles.includes('SUPER_ADMIN');
      const waitingWhere: Prisma.ApprovalInstanceWhereInput = {
        organizationId: user.organizationId,
        status: ApprovalStatus.PENDING,
        createdBy: { not: user.id },
      };
      if (!isSuperAdmin) {
        const matchingSteps = await this.prisma.workflowStep.findMany({
          where: { requiredRole: { in: [...user.roles, '*'] } },
          select: { versionId: true, stepOrder: true },
        });
        if (matchingSteps.length === 0) {
          items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return items.slice(0, 60);
        }
        waitingWhere.OR = matchingSteps.map((s) => ({
          versionId: s.versionId,
          currentStepOrder: s.stepOrder,
        }));
      }
      const waiting = await this.prisma.approvalInstance.findMany({
        where: waitingWhere,
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: {
          version: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
        },
      });
      for (const i of waiting) {
        const step = i.version.steps.find(
          (s) => s.stepOrder === i.currentStepOrder,
        );
        if (
          !step ||
          (step.requiredRole !== '*' &&
            !user.roles.includes(step.requiredRole) &&
            !isSuperAdmin)
        ) {
          continue;
        }
        items.push({
          id: i.id,
          resourceType: i.resourceType,
          resourceId: i.resourceId,
          status: i.status,
          mine: false,
          currentStepName: step.name,
          requiredRole: step.requiredRole,
          createdAt: i.createdAt,
        });
      }
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items.slice(0, 60);
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
      employeeId: p.employeeId ?? employee.id,
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
      employeeId: p.employeeId ?? employee.id,
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
      loanType: l.loanType,
      principalAmount: Number(l.principalAmount),
      interestRate: Number(l.interestRate),
      termMonths: l.termMonths,
      monthlyInstallment: Number(l.monthlyInstallment),
      status: l.status,
      purpose: l.purpose,
      itemName: l.itemName,
      supplierName: l.supplierName,
      itemCost: l.itemCost != null ? Number(l.itemCost) : null,
      issuedAt: l.issuedAt,
      employeeAcknowledgedAt: l.employeeAcknowledgedAt,
      settledAt: l.settledAt,
      approvalInstanceId: l.approvalInstanceId,
      approvedBy: l.approvedBy,
      approvedAt: l.approvedAt,
      disbursedAt: l.disbursedAt,
      createdAt: l.createdAt,
    }));
  }

  async getMyLoanStatement(id: string, user: AuthUser) {
    const employee = await this.requireLinkedEmployee(user);
    const loan = await this.prisma.employeeLoan.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        employeeId: employee.id,
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');

    const installments = await this.prisma.loanInstallment.findMany({
      where: { loanId: id },
      orderBy: { installmentNumber: 'asc' },
    });
    const totalDue = round2(
      installments.reduce((s, i) => s + Number(i.amountDue), 0),
    );
    const totalPaid = round2(
      installments.reduce((s, i) => s + Number(i.amountPaid), 0),
    );
    const outstandingBalance = round2(Math.max(0, totalDue - totalPaid));

    return {
      loan: {
        id: loan.id,
        loanNumber: loan.loanNumber,
        loanType: loan.loanType,
        status: loan.status,
        principalAmount: Number(loan.principalAmount),
        monthlyInstallment: Number(loan.monthlyInstallment),
        termMonths: loan.termMonths,
        itemName: loan.itemName,
        employeeAcknowledgedAt: loan.employeeAcknowledgedAt,
        settledAt: loan.settledAt,
      },
      installments: installments.map((i) => ({
        installmentNumber: i.installmentNumber,
        dueDate: i.dueDate,
        amountDue: Number(i.amountDue),
        amountPaid: Number(i.amountPaid),
        status: i.status,
        paidAt: i.paidAt,
      })),
      totalDue,
      totalPaid,
      outstandingBalance,
      isSettled:
        loan.status === LoanStatus.COMPLETED || outstandingBalance <= 0,
    };
  }

  async acknowledgeMyLoan(id: string, user: AuthUser) {
    const employee = await this.requireLinkedEmployee(user);
    const loan = await this.prisma.employeeLoan.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        employeeId: employee.id,
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE loans can be acknowledged');
    }
    if (!ESS_ITEM_LOAN_TYPES.includes(loan.loanType)) {
      throw new BadRequestException('Acknowledgement applies to item loans only');
    }
    if (loan.employeeAcknowledgedAt) {
      return { employeeAcknowledgedAt: loan.employeeAcknowledgedAt };
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
      after: { via: 'ess' },
    });
    return { employeeAcknowledgedAt: updated.employeeAcknowledgedAt };
  }

  async applyLoan(dto: EssApplyLoanDto, user: AuthUser) {
    const employee = await this.requireLinkedEmployee(user);
    if (ESS_ITEM_LOAN_TYPES.includes(dto.loanType) && !dto.itemName?.trim()) {
      throw new BadRequestException({
        error: 'ITEM_NAME_REQUIRED',
        message: 'itemName is required for item-based loan types',
      });
    }

    const loanNumber = await this.nextLoanNumber(user.organizationId);
    const monthlyInstallment = round2(dto.principalAmount / dto.termMonths);

    const loan = await this.prisma.employeeLoan.create({
      data: {
        organizationId: user.organizationId,
        employeeId: employee.id,
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
      after: { ...updated, channel: 'ess' },
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      employeeId: updated.employeeId,
      loanNumber: updated.loanNumber,
      loanType: updated.loanType,
      principalAmount: Number(updated.principalAmount),
      interestRate: Number(updated.interestRate),
      termMonths: updated.termMonths,
      monthlyInstallment: Number(updated.monthlyInstallment),
      status: updated.status,
      purpose: updated.purpose,
      itemName: updated.itemName,
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
    const employee = await this.requireLinkedEmployee(user);
    return this.financeOps.createEssPettyCashVoucher(
      {
        ...dto,
        department: dto.department?.trim() || employee.department || undefined,
      },
      user,
    );
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

  async confirmMyEquipment(
    assignmentId: string,
    user: AuthUser,
  ): Promise<EssEquipmentResponseDto> {
    const employee = await this.requireLinkedEmployee(user);

    const row = await this.prisma.assetAssignment.findFirst({
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
      include: { asset: true },
    });
    if (!row) {
      throw new NotFoundException(
        'Active assignment not found for your profile',
      );
    }
    if (row.confirmedAt) {
      return this.toEquipmentDto(row, row.asset);
    }

    const updated = await this.prisma.assetAssignment.update({
      where: { id: row.id },
      data: { confirmedAt: new Date(), confirmedBy: user.id },
      include: { asset: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'asset.assignment.confirmed',
      resourceType: 'AssetAssignment',
      resourceId: updated.id,
      after: {
        assetId: updated.assetId,
        confirmedAt: updated.confirmedAt,
      },
    });

    return this.toEquipmentDto(updated, updated.asset);
  }

  private toEquipmentDto(
    a: {
      id: string;
      assetId: string;
      assignedAt: Date;
      notes: string | null;
      returnRequestedAt?: Date | null;
      confirmedAt?: Date | null;
    },
    asset: {
      assetTag: string;
      name: string;
      category: string | null;
    },
  ): EssEquipmentResponseDto {
    const requested = !!a.returnRequestedAt;
    const confirmed = !!a.confirmedAt;
    return {
      assignmentId: a.id,
      assetId: a.assetId,
      assetTag: asset.assetTag,
      name: asset.name,
      category: asset.category,
      assignedAt: a.assignedAt,
      notes: a.notes,
      status: requested
        ? 'RETURN_REQUESTED'
        : confirmed
          ? 'CONFIRMED'
          : 'ASSIGNED',
      returnRequestedAt: a.returnRequestedAt ?? null,
      confirmedAt: a.confirmedAt ?? null,
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
