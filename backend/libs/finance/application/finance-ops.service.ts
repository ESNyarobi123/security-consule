import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentVoucherStatus,
  PettyCashVoucherStatus,
  Prisma,
  ReceiptPayerType,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import { InvoicesService } from './invoices.service';
import {
  CreateEssPettyCashVoucherDto,
  CreateFinanceReceiptDto,
  CreatePaymentVoucherDto,
  CreatePettyCashFundDto,
  CreatePettyCashVoucherDto,
  FinanceReceiptResponseDto,
  FinanceReportResponseDto,
  PaymentVoucherResponseDto,
  PettyCashFundResponseDto,
  PettyCashVoucherResponseDto,
  RejectPettyCashVoucherDto,
  ReimbursePettyCashVoucherDto,
} from '../presentation/dto/finance.dto';

type ApprovalInfo = {
  status: string;
  stepOrder: number | null;
  stepName: string | null;
  requiredRole: string | null;
};

@Injectable()
export class FinanceOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly invoices: InvoicesService,
  ) {}

  async createPettyCashFund(
    dto: CreatePettyCashFundDto,
    user: AuthUser,
  ): Promise<PettyCashFundResponseDto> {
    const fund = await this.prisma.pettyCashFund.create({
      data: {
        organizationId: user.organizationId,
        branchId: dto.branchId,
        name: dto.name,
        imprestAmount: new Prisma.Decimal(dto.imprestAmount),
        currentBalance: new Prisma.Decimal(dto.imprestAmount),
        custodianId: dto.custodianId,
        createdBy: user.id,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'petty_cash.fund.created',
      resourceType: 'PettyCashFund',
      resourceId: fund.id,
      after: fund,
    });
    return this.toFundDto(fund);
  }

  async listPettyCashFunds(
    organizationId: string,
  ): Promise<PettyCashFundResponseDto[]> {
    const rows = await this.prisma.pettyCashFund.findMany({
      where: { organizationId, isActive: true },
    });
    return rows.map((f) => this.toFundDto(f));
  }

  async createPettyCashVoucher(
    dto: CreatePettyCashVoucherDto,
    user: AuthUser,
  ): Promise<PettyCashVoucherResponseDto> {
    const fund = await this.prisma.pettyCashFund.findFirst({
      where: { id: dto.fundId, organizationId: user.organizationId },
    });
    if (!fund) throw new NotFoundException('Petty cash fund not found');

    return this.createPettyCashVoucherOnFund(fund.id, dto, user);
  }

  /**
   * ESS apply — auto-picks org default active fund (HQ Petty Cash preferred).
   * Employees never choose fundId.
   */
  async createEssPettyCashVoucher(
    dto: CreateEssPettyCashVoucherDto,
    user: AuthUser,
    channel: 'ess' | 'ops' = 'ess',
  ): Promise<PettyCashVoucherResponseDto> {
    const fundId = await this.resolveDefaultFundId(user.organizationId);
    return this.createPettyCashVoucherOnFund(fundId, dto, user, channel);
  }

  async listPettyCashVouchers(
    organizationId: string,
    status?: PettyCashVoucherStatus,
  ): Promise<PettyCashVoucherResponseDto[]> {
    const rows = await this.prisma.pettyCashVoucher.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return this.toPettyVoucherDtos(rows);
  }

  /** Portal 35.23 — branch-scoped voucher list (issue/approve stay finance.manage). */
  async listPettyCashVouchersForBranches(
    organizationId: string,
    branchIds: string[] | null,
  ): Promise<PettyCashVoucherResponseDto[]> {
    const rows = await this.prisma.pettyCashVoucher.findMany({
      where: {
        organizationId,
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return this.toPettyVoucherDtos(rows);
  }

  async countPendingPettyCashForBranches(
    organizationId: string,
    branchIds: string[] | null,
  ): Promise<number> {
    return this.prisma.pettyCashVoucher.count({
      where: {
        organizationId,
        status: PettyCashVoucherStatus.PENDING,
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
    });
  }

  async listMyPettyCashVouchers(
    user: AuthUser,
  ): Promise<PettyCashVoucherResponseDto[]> {
    const rows = await this.prisma.pettyCashVoucher.findMany({
      where: {
        organizationId: user.organizationId,
        createdBy: user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return this.toPettyVoucherDtos(rows);
  }

  async approvePettyCashVoucher(
    id: string,
    user: AuthUser,
  ): Promise<PettyCashVoucherResponseDto> {
    const voucher = await this.findPendingPettyOrThrow(id, user.organizationId);
    if (!voucher.approvalInstanceId) {
      throw new BadRequestException({
        error: 'NO_APPROVAL_INSTANCE',
        message:
          'This voucher has no approval instance. Re-submit it from ESS so Finance/GM can approve it.',
      });
    }

    const approval = await this.actOnApproval(
      voucher.approvalInstanceId,
      'APPROVE',
      user,
    );

    // Multi-step safe: voucher stays PENDING until workflow fully APPROVED.
    // Cash is NOT issued here (Module 22-A — no issue without approval).
    if (approval.status !== 'APPROVED') {
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'petty_cash.voucher.approval_step',
        resourceType: 'PettyCashVoucher',
        resourceId: id,
        after: {
          approvalStatus: approval.status,
          currentStepOrder: approval.currentStepOrder,
        },
      });
      return (await this.toPettyVoucherDtos([voucher]))[0]!;
    }

    const updated = await this.prisma.pettyCashVoucher.update({
      where: { id },
      data: {
        status: PettyCashVoucherStatus.APPROVED,
        approvedBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'petty_cash.voucher.approved',
      resourceType: 'PettyCashVoucher',
      resourceId: id,
      after: updated,
    });

    return (await this.toPettyVoucherDtos([updated]))[0]!;
  }

  /**
   * Issue cash after approval. Debits imprest. Creator ≠ issuer.
   */
  async issuePettyCashVoucher(
    id: string,
    user: AuthUser,
  ): Promise<PettyCashVoucherResponseDto> {
    const voucher = await this.prisma.pettyCashVoucher.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status === PettyCashVoucherStatus.ISSUED) {
      throw new BadRequestException({
        error: 'ALREADY_ISSUED',
        message: 'Cash has already been issued for this voucher',
      });
    }
    if (voucher.status === PettyCashVoucherStatus.PENDING) {
      throw new BadRequestException({
        error: 'NOT_APPROVED',
        message: 'No petty cash shall be issued without approval',
      });
    }
    if (voucher.status !== PettyCashVoucherStatus.APPROVED) {
      throw new BadRequestException({
        error: 'NOT_ISSUABLE',
        message: `Cannot issue petty cash in status ${voucher.status}`,
      });
    }
    if (voucher.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_ISSUE',
        message: 'The officer who requested this petty cash cannot issue it',
      });
    }

    const issuedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.pettyCashFund.findFirst({
        where: { id: voucher.fundId, organizationId: user.organizationId },
      });
      if (!locked) throw new NotFoundException('Petty cash fund not found');
      if (locked.currentBalance.lt(voucher.amount)) {
        throw new BadRequestException({
          error: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient petty cash balance',
        });
      }
      await tx.pettyCashFund.update({
        where: { id: voucher.fundId },
        data: { currentBalance: { decrement: voucher.amount } },
      });
      return tx.pettyCashVoucher.update({
        where: { id },
        data: {
          status: PettyCashVoucherStatus.ISSUED,
          issuedBy: user.id,
          issuedAt,
        },
      });
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'petty_cash.voucher.issued',
      resourceType: 'PettyCashVoucher',
      resourceId: id,
      after: updated,
    });

    return (await this.toPettyVoucherDtos([updated]))[0]!;
  }

  async rejectPettyCashVoucher(
    id: string,
    dto: RejectPettyCashVoucherDto,
    user: AuthUser,
  ): Promise<PettyCashVoucherResponseDto> {
    const voucher = await this.findPendingPettyOrThrow(id, user.organizationId);

    if (voucher.approvalInstanceId) {
      await this.actOnApproval(
        voucher.approvalInstanceId,
        'REJECT',
        user,
        dto.reason,
      );
    }

    const updated = await this.prisma.pettyCashVoucher.update({
      where: { id },
      data: {
        status: PettyCashVoucherStatus.REJECTED,
        rejectedReason: dto.reason,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'petty_cash.voucher.rejected',
      resourceType: 'PettyCashVoucher',
      resourceId: id,
      after: { ...updated, rejectedReason: dto.reason },
    });

    return (await this.toPettyVoucherDtos([updated]))[0]!;
  }

  /**
   * Retire after issue: ISSUED → REIMBURSED (receipt on file).
   * Imprest was already debited on issue; this closes the voucher.
   */
  async reimbursePettyCashVoucher(
    id: string,
    dto: ReimbursePettyCashVoucherDto,
    user: AuthUser,
  ): Promise<PettyCashVoucherResponseDto> {
    const receiptUrl = dto.receiptUrl?.trim() || undefined;
    const notes = dto.notes?.trim() || undefined;
    if (!receiptUrl && !notes) {
      throw new BadRequestException(
        'Provide receiptUrl or notes as an auditable receipt signal',
      );
    }

    const voucher = await this.prisma.pettyCashVoucher.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');

    if (voucher.status === PettyCashVoucherStatus.REIMBURSED) {
      throw new BadRequestException('Voucher is already retired');
    }
    if (voucher.status === PettyCashVoucherStatus.PENDING) {
      throw new BadRequestException(
        'Voucher must be approved and issued before retirement',
      );
    }
    if (voucher.status === PettyCashVoucherStatus.REJECTED) {
      throw new BadRequestException('Rejected vouchers cannot be retired');
    }
    if (voucher.status === PettyCashVoucherStatus.APPROVED) {
      throw new BadRequestException({
        error: 'NOT_ISSUED',
        message: 'Issue cash before retiring the voucher with a receipt',
      });
    }
    if (voucher.status !== PettyCashVoucherStatus.ISSUED) {
      throw new BadRequestException(
        `Cannot retire voucher in status ${voucher.status}`,
      );
    }

    if (voucher.createdBy === user.id) {
      throw new ForbiddenException(
        'Creator cannot retire their own petty cash voucher',
      );
    }

    if (receiptUrl?.startsWith('document:')) {
      await this.assertPettyCashDocumentRef(
        receiptUrl,
        id,
        user.organizationId,
      );
    }

    const reimbursedAt = new Date();
    const updated = await this.prisma.pettyCashVoucher.update({
      where: { id },
      data: {
        status: PettyCashVoucherStatus.REIMBURSED,
        reimbursedAt,
        ...(receiptUrl ? { receiptUrl } : {}),
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'petty_cash.voucher.retired',
      resourceType: 'PettyCashVoucher',
      resourceId: id,
      after: {
        ...updated,
        reimbursedBy: user.id,
        receiptNotes: notes ?? null,
      },
    });

    return (await this.toPettyVoucherDtos([updated]))[0]!;
  }

  /**
   * When UI stores receiptUrl as document:{DocumentObject.id}, bind to this
   * voucher + org so reimbursed receipts cannot reference dangling/cross-voucher docs.
   */
  private async assertPettyCashDocumentRef(
    receiptUrl: string,
    voucherId: string,
    organizationId: string,
  ): Promise<void> {
    const docId = receiptUrl.slice('document:'.length).trim();
    if (!docId) {
      throw new BadRequestException('Invalid document receipt reference');
    }
    const doc = await this.prisma.documentObject.findFirst({
      where: {
        id: docId,
        organizationId,
        resourceType: 'PettyCashVoucher',
        resourceId: voucherId,
      },
      select: { id: true },
    });
    if (!doc) {
      throw new BadRequestException(
        'document: receipt must reference a MinIO file attached to this voucher',
      );
    }
  }

  private async findPendingPettyOrThrow(id: string, organizationId: string) {
    const voucher = await this.prisma.pettyCashVoucher.findFirst({
      where: { id, organizationId },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status !== PettyCashVoucherStatus.PENDING) {
      throw new BadRequestException(
        'Only pending petty cash vouchers can be acted on',
      );
    }
    return voucher;
  }

  private async resolveDefaultFundId(organizationId: string): Promise<string> {
    const named = await this.prisma.pettyCashFund.findFirst({
      where: {
        organizationId,
        isActive: true,
        name: 'HQ Petty Cash',
      },
    });
    if (named) return named.id;

    const any = await this.prisma.pettyCashFund.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!any) {
      throw new BadRequestException(
        'No active petty cash fund. Ask Finance to create an imprest fund.',
      );
    }
    return any.id;
  }

  private async createPettyCashVoucherOnFund(
    fundId: string,
    dto: {
      amount: number;
      purpose: string;
      category: string;
      receiptUrl?: string;
      branchId?: string;
      department?: string;
    },
    user: AuthUser,
    channel: 'admin' | 'ess' | 'ops' = 'admin',
  ): Promise<PettyCashVoucherResponseDto> {
    const fund = await this.prisma.pettyCashFund.findFirst({
      where: { id: fundId, organizationId: user.organizationId },
    });
    if (!fund) throw new NotFoundException('Petty cash fund not found');

    const branchId = await this.resolveBranchId(
      user,
      dto.branchId ?? fund.branchId ?? user.allowedBranchIds?.[0] ?? null,
    );
    const department = dto.department?.trim() || null;

    const voucherNumber = await this.nextVoucherNumber(user.organizationId);
    const voucher = await this.prisma.pettyCashVoucher.create({
      data: {
        organizationId: user.organizationId,
        fundId,
        voucherNumber,
        amount: new Prisma.Decimal(dto.amount),
        purpose: dto.purpose,
        category: dto.category,
        receiptUrl: dto.receiptUrl,
        branchId,
        department,
        createdBy: user.id,
      },
    });

    const approval = await this.approvals.start(
      {
        workflowCode: 'petty-cash-approval',
        resourceType: 'PettyCashVoucher',
        resourceId: voucher.id,
        amount: dto.amount,
      },
      user,
    );

    const updated = await this.prisma.pettyCashVoucher.update({
      where: { id: voucher.id },
      data: { approvalInstanceId: approval.id },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'petty_cash.voucher.created',
      resourceType: 'PettyCashVoucher',
      resourceId: voucher.id,
      after: { ...updated, channel },
    });

    return (await this.toPettyVoucherDtos([updated]))[0]!;
  }

  async createPaymentVoucher(
    dto: CreatePaymentVoucherDto,
    user: AuthUser,
  ): Promise<PaymentVoucherResponseDto> {
    const voucherNumber = await this.nextPaymentVoucherNumber(
      user.organizationId,
    );
    const voucher = await this.prisma.paymentVoucher.create({
      data: {
        organizationId: user.organizationId,
        voucherNumber,
        payeeName: dto.payeeName,
        supplierId: dto.supplierId,
        purchaseOrderId: dto.purchaseOrderId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? 'TZS',
        purpose: dto.purpose,
        createdBy: user.id,
      },
    });

    const approval = await this.approvals.start(
      {
        workflowCode: 'payment-voucher-approval',
        resourceType: 'PaymentVoucher',
        resourceId: voucher.id,
        amount: dto.amount,
      },
      user,
    );

    const updated = await this.prisma.paymentVoucher.update({
      where: { id: voucher.id },
      data: {
        status: PaymentVoucherStatus.PENDING_APPROVAL,
        approvalInstanceId: approval.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'payment_voucher.created',
      resourceType: 'PaymentVoucher',
      resourceId: voucher.id,
      after: updated,
    });

    return (await this.toPaymentVoucherDtos([updated]))[0]!;
  }

  async approvePaymentVoucher(
    id: string,
    user: AuthUser,
  ): Promise<PaymentVoucherResponseDto> {
    const voucher = await this.prisma.paymentVoucher.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!voucher) throw new NotFoundException('Payment voucher not found');
    if (!voucher.approvalInstanceId) {
      throw new BadRequestException({
        error: 'NO_APPROVAL_INSTANCE',
        message:
          'This voucher has no approval instance. Re-create it so the GM approval step is started.',
      });
    }

    const approval = await this.actOnApproval(
      voucher.approvalInstanceId,
      'APPROVE',
      user,
    );

    if (approval.status !== 'APPROVED') {
      await this.audit.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'payment_voucher.approval_step',
        resourceType: 'PaymentVoucher',
        resourceId: id,
        after: {
          approvalStatus: approval.status,
          currentStepOrder: approval.currentStepOrder,
        },
      });
      return (await this.toPaymentVoucherDtos([voucher]))[0]!;
    }

    const updated = await this.prisma.paymentVoucher.update({
      where: { id },
      data: {
        status: PaymentVoucherStatus.APPROVED,
        approvedBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'payment_voucher.approved',
      resourceType: 'PaymentVoucher',
      resourceId: id,
      after: updated,
    });

    return (await this.toPaymentVoucherDtos([updated]))[0]!;
  }

  async payPaymentVoucher(
    id: string,
    paymentReference: string,
    user: AuthUser,
  ): Promise<PaymentVoucherResponseDto> {
    const voucher = await this.prisma.paymentVoucher.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!voucher) throw new NotFoundException('Payment voucher not found');
    if (voucher.status !== PaymentVoucherStatus.APPROVED) {
      throw new BadRequestException('Voucher must be approved before payment');
    }
    if (voucher.createdBy === user.id) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_PAY',
        message: 'The officer who created this voucher cannot mark it paid',
      });
    }

    const updated = await this.prisma.paymentVoucher.update({
      where: { id },
      data: {
        status: PaymentVoucherStatus.PAID,
        paidAt: new Date(),
        paymentReference,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'payment_voucher.paid',
      resourceType: 'PaymentVoucher',
      resourceId: id,
      after: updated,
    });

    return (await this.toPaymentVoucherDtos([updated]))[0]!;
  }

  async listPaymentVouchers(
    organizationId: string,
  ): Promise<PaymentVoucherResponseDto[]> {
    const rows = await this.prisma.paymentVoucher.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return this.toPaymentVoucherDtos(rows);
  }

  async getReports(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<FinanceReportResponseDto> {
    const period = this.resolveReportPeriod(from, to);
    const organizationId = user.organizationId;
    const money = (count: number, amount: number) => ({ count, amount });

    const [
      invoices,
      receipts,
      pettyIssued,
      pettyRetired,
      vouchersPaid,
    ] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { organizationId },
        select: {
          status: true,
          totalAmount: true,
          amountPaid: true,
          serviceType: true,
          createdAt: true,
        },
      }),
      this.prisma.invoicePayment.findMany({
        where: {
          organizationId,
          recordedAt: { gte: period.from, lte: period.to },
        },
        select: {
          amount: true,
          invoice: { select: { serviceType: true } },
        },
      }),
      this.prisma.pettyCashVoucher.findMany({
        where: {
          organizationId,
          issuedAt: { gte: period.from, lte: period.to },
        },
        select: { amount: true },
      }),
      this.prisma.pettyCashVoucher.findMany({
        where: {
          organizationId,
          reimbursedAt: { gte: period.from, lte: period.to },
        },
        select: { amount: true },
      }),
      this.prisma.paymentVoucher.findMany({
        where: {
          organizationId,
          status: PaymentVoucherStatus.PAID,
          paidAt: { gte: period.from, lte: period.to },
        },
        select: { amount: true, supplierId: true },
      }),
    ]);

    const inPeriod = invoices.filter(
      (i) => i.createdAt >= period.from && i.createdAt <= period.to,
    );
    const outstandingRows = invoices.filter((i) =>
      (
        [
          InvoiceStatus.SENT,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.OVERDUE,
          InvoiceStatus.DISPUTED,
        ] as InvoiceStatus[]
      ).includes(i.status),
    );
    const parkingInvoices = inPeriod.filter(
      (i) => (i.serviceType ?? '').toUpperCase() === 'PARKING',
    );
    const parkingReceipts = receipts.filter(
      (p) => (p.invoice.serviceType ?? '').toUpperCase() === 'PARKING',
    );
    const supplierPaid = vouchersPaid.filter((v) => v.supplierId);

    const pack: FinanceReportResponseDto = {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      invoicesIssued: money(
        inPeriod.length,
        inPeriod.reduce((s, i) => s + Number(i.totalAmount), 0),
      ),
      customerReceipts: money(
        receipts.length,
        receipts.reduce((s, p) => s + Number(p.amount), 0),
      ),
      outstanding: money(
        outstandingRows.length,
        outstandingRows.reduce(
          (s, i) => s + Math.max(Number(i.totalAmount) - Number(i.amountPaid), 0),
          0,
        ),
      ),
      parkingBilled: money(
        parkingInvoices.length,
        parkingInvoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      ),
      parkingReceipts: money(
        parkingReceipts.length,
        parkingReceipts.reduce((s, p) => s + Number(p.amount), 0),
      ),
      pettyCashIssued: money(
        pettyIssued.length,
        pettyIssued.reduce((s, v) => s + Number(v.amount), 0),
      ),
      pettyCashRetired: money(
        pettyRetired.length,
        pettyRetired.reduce((s, v) => s + Number(v.amount), 0),
      ),
      supplierPayments: money(
        supplierPaid.length,
        supplierPaid.reduce((s, v) => s + Number(v.amount), 0),
      ),
      paymentVouchersPaid: money(
        vouchersPaid.length,
        vouchersPaid.reduce((s, v) => s + Number(v.amount), 0),
      ),
      bankReconciliationImplemented: false,
      notes: [
        'Receipts on the overview: customerReceipts = invoice payments; pettyCashRetired = MinIO retire after issue. No separate receipts table.',
        'Bank reconciliations are not in this slice (no statement import / matching engine). Payment references stay on receipts and AP vouchers.',
        'Loan deductions and company payroll live on Portal 35.16 (/payroll) from immutable PayslipSnapshot — not recomputed here.',
        'Internal Auditor uses Compliance/Audit (audit.read). This portal stays finance.manage mutate.',
      ],
    };

    await this.audit.record({
      organizationId,
      actorId: user.id,
      action: 'finance.reports.generated',
      resourceType: 'FinanceReport',
      resourceId: organizationId,
      after: { from: pack.from, to: pack.to },
    });

    return pack;
  }

  private resolveReportPeriod(from?: string, to?: string): { from: Date; to: Date } {
    const end = to ? new Date(to) : new Date();
    const start = from
      ? new Date(from)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException({
        error: 'INVALID_PERIOD',
        message: 'from/to must be valid dates',
      });
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to.trim())) {
      end.setUTCHours(23, 59, 59, 999);
    }
    if (start > end) {
      throw new BadRequestException({
        error: 'INVALID_PERIOD',
        message: 'from must be before to',
      });
    }
    return { from: start, to: end };
  }

  private async nextVoucherNumber(organizationId: string): Promise<string> {
    const count = await this.prisma.pettyCashVoucher.count({
      where: { organizationId },
    });
    return `PCV-${String(count + 1).padStart(5, '0')}`;
  }

  private async nextPaymentVoucherNumber(
    organizationId: string,
  ): Promise<string> {
    const count = await this.prisma.paymentVoucher.count({
      where: { organizationId },
    });
    return `PV-${String(count + 1).padStart(5, '0')}`;
  }

  private toFundDto(f: {
    id: string;
    organizationId: string;
    branchId: string | null;
    name: string;
    imprestAmount: Prisma.Decimal;
    currentBalance: Prisma.Decimal;
    custodianId: string | null;
    isActive: boolean;
  }): PettyCashFundResponseDto {
    return {
      id: f.id,
      organizationId: f.organizationId,
      branchId: f.branchId,
      name: f.name,
      imprestAmount: Number(f.imprestAmount),
      currentBalance: Number(f.currentBalance),
      custodianId: f.custodianId,
      isActive: f.isActive,
    };
  }

  private async resolveBranchId(
    user: AuthUser,
    candidate: string | null,
  ): Promise<string | null> {
    if (!candidate) return null;
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: candidate,
        organizationId: user.organizationId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException({
        error: 'INVALID_BRANCH',
        message: 'Branch not found in this organisation',
      });
    }
    return branch.id;
  }

  private async toPettyVoucherDtos(
    rows: {
      id: string;
      organizationId: string;
      fundId: string;
      voucherNumber: string;
      amount: Prisma.Decimal;
      purpose: string;
      category: string;
      receiptUrl?: string | null;
      status: PettyCashVoucherStatus;
      approvalInstanceId: string | null;
      approvedBy: string | null;
      issuedBy?: string | null;
      issuedAt?: Date | null;
      reimbursedAt: Date | null;
      branchId?: string | null;
      department?: string | null;
      rejectedReason?: string | null;
      createdBy: string;
      createdAt: Date;
    }[],
  ): Promise<PettyCashVoucherResponseDto[]> {
    if (rows.length === 0) return [];
    const branchIds = [
      ...new Set(rows.map((r) => r.branchId).filter((id): id is string => !!id)),
    ];
    const fundIds = [...new Set(rows.map((r) => r.fundId))];
    const [branches, funds] = await Promise.all([
      branchIds.length
        ? this.prisma.branch.findMany({
            where: { id: { in: branchIds } },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve([]),
      this.prisma.pettyCashFund.findMany({
        where: { id: { in: fundIds } },
        select: { id: true, name: true, currentBalance: true },
      }),
    ]);
    const branchById = new Map(branches.map((b) => [b.id, b]));
    const fundById = new Map(funds.map((f) => [f.id, f]));
    const approvalByResource = await this.approvalInfoFor(
      rows[0]!.organizationId,
      'PettyCashVoucher',
      rows.map((r) => r.id),
    );
    return rows.map((v) => {
      const branch = v.branchId ? branchById.get(v.branchId) : undefined;
      const fund = fundById.get(v.fundId);
      const approval = approvalByResource.get(v.id);
      return {
        id: v.id,
        organizationId: v.organizationId,
        fundId: v.fundId,
        fundName: fund?.name ?? null,
        fundBalance: fund ? Number(fund.currentBalance) : null,
        voucherNumber: v.voucherNumber,
        amount: Number(v.amount),
        purpose: v.purpose,
        category: v.category,
        receiptUrl: v.receiptUrl ?? null,
        status: v.status,
        approvalInstanceId: v.approvalInstanceId,
        approvalStatus: approval?.status ?? null,
        approvalStepOrder: approval?.stepOrder ?? null,
        approvalCurrentStepName: approval?.stepName ?? null,
        approvalRequiredRole: approval?.requiredRole ?? null,
        approvedBy: v.approvedBy,
        issuedBy: v.issuedBy ?? null,
        issuedAt: v.issuedAt ?? null,
        reimbursedAt: v.reimbursedAt,
        branchId: v.branchId ?? null,
        branchCode: branch?.code ?? null,
        branchName: branch?.name ?? null,
        department: v.department ?? null,
        rejectedReason: v.rejectedReason ?? null,
        createdBy: v.createdBy,
        createdAt: v.createdAt,
      };
    });
  }

  /** Portal 35.15 receipts — capture details, attach a MinIO scan, optional invoice link. */
  async createFinanceReceipt(
    dto: CreateFinanceReceiptDto,
    user: AuthUser,
  ): Promise<FinanceReceiptResponseDto> {
    let customerId = dto.customerId ?? null;
    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!customer) {
        throw new BadRequestException({
          error: 'INVALID_CUSTOMER',
          message: 'Customer not found in this organisation',
        });
      }
    }

    let invoiceId: string | null = null;
    let invoicePaymentId: string | null = null;
    if (dto.invoiceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: dto.invoiceId, organizationId: user.organizationId },
        select: { id: true, customerId: true },
      });
      if (!invoice) {
        throw new BadRequestException({
          error: 'INVALID_INVOICE',
          message: 'Invoice not found in this organisation',
        });
      }
      if (customerId && invoice.customerId !== customerId) {
        throw new BadRequestException({
          error: 'INVOICE_CUSTOMER_MISMATCH',
          message: 'The invoice belongs to a different customer',
        });
      }
      customerId = invoice.customerId;
      const recorded = await this.invoices.recordPaymentWithRef(
        invoice.id,
        {
          amount: dto.amount,
          paymentReference:
            dto.paymentReference?.trim() ||
            dto.receiptNumber?.trim() ||
            'receipt',
          paymentMethod: dto.paymentMethod,
        },
        user,
      );
      invoiceId = invoice.id;
      invoicePaymentId = recorded.paymentId;
    }

    const receiptNumber =
      dto.receiptNumber?.trim() ||
      (await this.nextReceiptNumber(user.organizationId));

    const existing = await this.prisma.financeReceipt.findFirst({
      where: {
        organizationId: user.organizationId,
        receiptNumber,
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException({
        error: 'RECEIPT_NUMBER_IN_USE',
        message: `Receipt ${receiptNumber} already exists`,
      });
    }

    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
    if (Number.isNaN(receivedAt.getTime())) {
      throw new BadRequestException({
        error: 'INVALID_RECEIVED_AT',
        message: 'receivedAt must be a valid date',
      });
    }

    const receipt = await this.prisma.financeReceipt.create({
      data: {
        organizationId: user.organizationId,
        receiptNumber,
        payerType: dto.payerType as ReceiptPayerType,
        payerName: dto.payerName.trim(),
        customerId,
        invoiceId,
        invoicePaymentId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency?.trim() || 'TZS',
        paymentMethod: dto.paymentMethod,
        paymentReference: dto.paymentReference?.trim() || null,
        receivedAt,
        notes: dto.notes?.trim() || null,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'finance.receipt.created',
      resourceType: 'FinanceReceipt',
      resourceId: receipt.id,
      after: receipt,
    });

    return (await this.toFinanceReceiptDtos([receipt]))[0]!;
  }

  async listFinanceReceipts(
    organizationId: string,
    opts: { from?: string; to?: string; take?: number } = {},
  ): Promise<FinanceReceiptResponseDto[]> {
    const where: Prisma.FinanceReceiptWhereInput = { organizationId };
    if (opts.from || opts.to) {
      const receivedAt: Prisma.DateTimeFilter = {};
      if (opts.from) {
        const from = new Date(opts.from);
        if (!Number.isNaN(from.getTime())) receivedAt.gte = from;
      }
      if (opts.to) {
        const to = new Date(opts.to);
        if (!Number.isNaN(to.getTime())) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(opts.to.trim())) {
            to.setUTCHours(23, 59, 59, 999);
          }
          receivedAt.lte = to;
        }
      }
      where.receivedAt = receivedAt;
    }
    const rows = await this.prisma.financeReceipt.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: Math.min(Math.max(opts.take ?? 100, 1), 200),
    });
    return this.toFinanceReceiptDtos(rows);
  }

  private async toFinanceReceiptDtos(
    rows: {
      id: string;
      organizationId: string;
      receiptNumber: string;
      payerType: ReceiptPayerType;
      payerName: string;
      customerId: string | null;
      invoiceId: string | null;
      invoicePaymentId: string | null;
      amount: Prisma.Decimal;
      currency: string;
      paymentMethod: PaymentMethod;
      paymentReference: string | null;
      receivedAt: Date;
      notes: string | null;
      createdBy: string;
      createdAt: Date;
    }[],
  ): Promise<FinanceReceiptResponseDto[]> {
    if (rows.length === 0) return [];
    const customerIds = [
      ...new Set(rows.map((r) => r.customerId).filter((x): x is string => !!x)),
    ];
    const invoiceIds = [
      ...new Set(rows.map((r) => r.invoiceId).filter((x): x is string => !!x)),
    ];
    const [customers, invoices, attachments] = await Promise.all([
      customerIds.length
        ? this.prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      invoiceIds.length
        ? this.prisma.invoice.findMany({
            where: { id: { in: invoiceIds } },
            select: { id: true, invoiceNumber: true },
          })
        : Promise.resolve([]),
      this.prisma.documentObject.groupBy({
        by: ['resourceId'],
        where: {
          organizationId: rows[0]!.organizationId,
          resourceType: 'FinanceReceipt',
          resourceId: { in: rows.map((r) => r.id) },
        },
        _count: { _all: true },
      }),
    ]);
    const customerById = new Map(customers.map((c) => [c.id, c.name]));
    const invoiceById = new Map(invoices.map((i) => [i.id, i.invoiceNumber]));
    const attachmentById = new Map(
      attachments.map((a) => [a.resourceId, a._count._all]),
    );
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      receiptNumber: r.receiptNumber,
      payerType: r.payerType,
      payerName: r.payerName,
      customerId: r.customerId,
      customerName: r.customerId ? customerById.get(r.customerId) ?? null : null,
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoiceId ? invoiceById.get(r.invoiceId) ?? null : null,
      invoicePaymentId: r.invoicePaymentId,
      amount: Number(r.amount),
      currency: r.currency,
      paymentMethod: r.paymentMethod,
      paymentReference: r.paymentReference,
      receivedAt: r.receivedAt,
      notes: r.notes,
      attachmentCount: attachmentById.get(r.id) ?? 0,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));
  }

  private async nextReceiptNumber(organizationId: string): Promise<string> {
    const count = await this.prisma.financeReceipt.count({
      where: { organizationId },
    });
    return `RCP-${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * Wrap approval.act so the UI gets an actionable code instead of a raw
   * FORBIDDEN when the signed-in officer is not the current step role.
   */
  private async actOnApproval(
    instanceId: string,
    decision: 'APPROVE' | 'REJECT',
    user: AuthUser,
    remarks?: string,
  ) {
    try {
      return await this.approvals.act(
        instanceId,
        { decision, remarks },
        user,
      );
    } catch (err) {
      if (err instanceof ForbiddenException) {
        const body = err.getResponse() as
          | string
          | { error?: string; message?: string | string[] };
        const code =
          typeof body === 'object' && body?.error
            ? body.error
            : 'APPROVAL_ROLE_REQUIRED';
        const raw =
          typeof body === 'string'
            ? body
            : Array.isArray(body?.message)
              ? body.message.join(', ')
              : body?.message ?? err.message;
        throw new ForbiddenException({
          error: code,
          message:
            code === 'CREATOR_CANNOT_APPROVE'
              ? 'Creator cannot approve their own request — another officer must decide.'
              : `${raw} — this step must be approved by the required role (or in the Approvals queue).`,
        });
      }
      throw err;
    }
  }

  /** Current-step name/role for each resource so the UI shows where it is waiting. */
  private async approvalInfoFor(
    organizationId: string,
    resourceType: string,
    resourceIds: string[],
  ): Promise<Map<string, ApprovalInfo>> {
    const out = new Map<string, ApprovalInfo>();
    if (resourceIds.length === 0) return out;
    const instances = await this.prisma.approvalInstance.findMany({
      where: {
        organizationId,
        resourceType,
        resourceId: { in: resourceIds },
      },
      include: {
        version: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
      },
    });
    for (const i of instances) {
      const step =
        i.status === 'PENDING'
          ? i.version.steps.find((s) => s.stepOrder === i.currentStepOrder)
          : undefined;
      out.set(i.resourceId, {
        status: i.status,
        stepOrder: i.status === 'PENDING' ? i.currentStepOrder : null,
        stepName: step?.name ?? null,
        requiredRole: step?.requiredRole ?? null,
      });
    }
    return out;
  }

  private async toPaymentVoucherDtos(
    rows: {
      id: string;
      organizationId: string;
      voucherNumber: string;
      payeeName: string;
      supplierId: string | null;
      purchaseOrderId: string | null;
      amount: Prisma.Decimal;
      currency: string;
      purpose: string;
      status: PaymentVoucherStatus;
      approvalInstanceId: string | null;
      approvedBy: string | null;
      paidAt: Date | null;
      paymentReference: string | null;
      createdAt: Date;
      createdBy: string;
    }[],
  ): Promise<PaymentVoucherResponseDto[]> {
    if (rows.length === 0) return [];
    const approvalByResource = await this.approvalInfoFor(
      rows[0]!.organizationId,
      'PaymentVoucher',
      rows.map((r) => r.id),
    );
    return rows.map((v) => {
      const approval = approvalByResource.get(v.id);
      return {
        id: v.id,
        organizationId: v.organizationId,
        voucherNumber: v.voucherNumber,
        payeeName: v.payeeName,
        supplierId: v.supplierId,
        purchaseOrderId: v.purchaseOrderId,
        amount: Number(v.amount),
        currency: v.currency,
        purpose: v.purpose,
        status: v.status,
        approvalInstanceId: v.approvalInstanceId,
        approvalStatus: approval?.status ?? null,
        approvalStepOrder: approval?.stepOrder ?? null,
        approvalCurrentStepName: approval?.stepName ?? null,
        approvalRequiredRole: approval?.requiredRole ?? null,
        approvedBy: v.approvedBy,
        paidAt: v.paidAt,
        paymentReference: v.paymentReference,
        createdBy: v.createdBy,
        createdAt: v.createdAt,
      };
    });
  }
}
