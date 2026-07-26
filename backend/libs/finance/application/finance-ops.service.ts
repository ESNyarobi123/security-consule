import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentVoucherStatus,
  PettyCashVoucherStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import {
  CreateEssPettyCashVoucherDto,
  CreatePaymentVoucherDto,
  CreatePettyCashFundDto,
  CreatePettyCashVoucherDto,
  PaymentVoucherResponseDto,
  PettyCashFundResponseDto,
  PettyCashVoucherResponseDto,
  RejectPettyCashVoucherDto,
  ReimbursePettyCashVoucherDto,
} from '../presentation/dto/finance.dto';

@Injectable()
export class FinanceOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
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
  ): Promise<PettyCashVoucherResponseDto> {
    const fundId = await this.resolveDefaultFundId(user.organizationId);
    return this.createPettyCashVoucherOnFund(fundId, dto, user, 'ess');
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
    return rows.map((v) => this.toPettyVoucherDto(v));
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
    return rows.map((v) => this.toPettyVoucherDto(v));
  }

  async approvePettyCashVoucher(
    id: string,
    user: AuthUser,
  ): Promise<PettyCashVoucherResponseDto> {
    const voucher = await this.findPendingPettyOrThrow(id, user.organizationId);
    if (!voucher.approvalInstanceId) {
      throw new BadRequestException('No approval instance');
    }

    // Fail closed before advancing approval — avoids APPROVED instance + PENDING voucher
    // when imprest cannot cover the amount (thin: approve also issues/debits).
    const fund = await this.prisma.pettyCashFund.findFirst({
      where: { id: voucher.fundId, organizationId: user.organizationId },
    });
    if (!fund) throw new NotFoundException('Petty cash fund not found');
    if (fund.currentBalance.lt(voucher.amount)) {
      throw new BadRequestException('Insufficient petty cash balance');
    }

    const approval = await this.approvals.act(
      voucher.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    // Multi-step safe: only debit fund when workflow fully APPROVED
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
      return this.toPettyVoucherDto(voucher);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.pettyCashFund.findFirst({
        where: { id: voucher.fundId, organizationId: user.organizationId },
      });
      if (!locked || locked.currentBalance.lt(voucher.amount)) {
        throw new BadRequestException('Insufficient petty cash balance');
      }
      await tx.pettyCashFund.update({
        where: { id: voucher.fundId },
        data: {
          currentBalance: { decrement: voucher.amount },
        },
      });
      return tx.pettyCashVoucher.update({
        where: { id },
        data: {
          status: PettyCashVoucherStatus.APPROVED,
          approvedBy: user.id,
        },
      });
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'petty_cash.voucher.approved',
      resourceType: 'PettyCashVoucher',
      resourceId: id,
      after: updated,
    });

    return this.toPettyVoucherDto(updated);
  }

  async rejectPettyCashVoucher(
    id: string,
    dto: RejectPettyCashVoucherDto,
    user: AuthUser,
  ): Promise<PettyCashVoucherResponseDto> {
    const voucher = await this.findPendingPettyOrThrow(id, user.organizationId);

    if (voucher.approvalInstanceId) {
      await this.approvals.act(
        voucher.approvalInstanceId,
        { decision: 'REJECT', remarks: dto.reason },
        user,
      );
    }

    const updated = await this.prisma.pettyCashVoucher.update({
      where: { id },
      data: { status: PettyCashVoucherStatus.REJECTED },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'petty_cash.voucher.rejected',
      resourceType: 'PettyCashVoucher',
      resourceId: id,
      after: { ...updated, rejectedReason: dto.reason },
    });

    return this.toPettyVoucherDto(updated);
  }

  /**
   * Retire/receipt after issue: APPROVED → REIMBURSED.
   * Imprest was already debited on final approve; this records the receipt signal.
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
      throw new BadRequestException('Voucher is already reimbursed');
    }
    if (voucher.status === PettyCashVoucherStatus.PENDING) {
      throw new BadRequestException(
        'Voucher must be approved before reimbursement',
      );
    }
    if (voucher.status === PettyCashVoucherStatus.REJECTED) {
      throw new BadRequestException('Rejected vouchers cannot be reimbursed');
    }
    if (voucher.status !== PettyCashVoucherStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot reimburse voucher in status ${voucher.status}`,
      );
    }

    if (voucher.createdBy === user.id) {
      throw new ForbiddenException(
        'Creator cannot mark their own voucher as reimbursed',
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
      action: 'petty_cash.voucher.reimbursed',
      resourceType: 'PettyCashVoucher',
      resourceId: id,
      after: {
        ...updated,
        reimbursedBy: user.id,
        receiptNotes: notes ?? null,
      },
    });

    return this.toPettyVoucherDto(updated);
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
    },
    user: AuthUser,
    channel: 'admin' | 'ess' = 'admin',
  ): Promise<PettyCashVoucherResponseDto> {
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

    return this.toPettyVoucherDto(updated);
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

    return this.toPaymentVoucherDto(updated);
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
      throw new BadRequestException('No approval instance');
    }

    await this.approvals.act(
      voucher.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

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

    return this.toPaymentVoucherDto(updated);
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

    return this.toPaymentVoucherDto(updated);
  }

  async listPaymentVouchers(
    organizationId: string,
  ): Promise<PaymentVoucherResponseDto[]> {
    const rows = await this.prisma.paymentVoucher.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((v) => this.toPaymentVoucherDto(v));
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

  private toPettyVoucherDto(v: {
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
    reimbursedAt: Date | null;
    createdBy: string;
    createdAt: Date;
  }): PettyCashVoucherResponseDto {
    return {
      id: v.id,
      organizationId: v.organizationId,
      fundId: v.fundId,
      voucherNumber: v.voucherNumber,
      amount: Number(v.amount),
      purpose: v.purpose,
      category: v.category,
      receiptUrl: v.receiptUrl ?? null,
      status: v.status,
      approvalInstanceId: v.approvalInstanceId,
      approvedBy: v.approvedBy,
      reimbursedAt: v.reimbursedAt,
      createdBy: v.createdBy,
      createdAt: v.createdAt,
    };
  }

  private toPaymentVoucherDto(v: {
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
  }): PaymentVoucherResponseDto {
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
      approvedBy: v.approvedBy,
      paidAt: v.paidAt,
      paymentReference: v.paymentReference,
      createdAt: v.createdAt,
    };
  }
}
