import {
  BadRequestException,
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
  CreatePaymentVoucherDto,
  CreatePettyCashFundDto,
  CreatePettyCashVoucherDto,
  PaymentVoucherResponseDto,
  PettyCashFundResponseDto,
  PettyCashVoucherResponseDto,
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

    const voucherNumber = await this.nextVoucherNumber(user.organizationId);
    const voucher = await this.prisma.pettyCashVoucher.create({
      data: {
        organizationId: user.organizationId,
        fundId: dto.fundId,
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
      after: updated,
    });

    return this.toPettyVoucherDto(updated);
  }

  async approvePettyCashVoucher(
    id: string,
    user: AuthUser,
  ): Promise<PettyCashVoucherResponseDto> {
    const voucher = await this.prisma.pettyCashVoucher.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { fund: true },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (!voucher.approvalInstanceId) {
      throw new BadRequestException('No approval instance');
    }

    await this.approvals.act(
      voucher.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    if (voucher.fund.currentBalance.lt(voucher.amount)) {
      throw new BadRequestException('Insufficient petty cash balance');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
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
    status: PettyCashVoucherStatus;
    approvalInstanceId: string | null;
    approvedBy: string | null;
    reimbursedAt: Date | null;
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
      status: v.status,
      approvalInstanceId: v.approvalInstanceId,
      approvedBy: v.approvedBy,
      reimbursedAt: v.reimbursedAt,
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
