import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractStatus,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateInvoiceDto,
  InvoiceResponseDto,
  InvoiceScanOverdueResultDto,
  RecordInvoicePaymentDto,
  VoidInvoiceDto,
} from '../presentation/dto/finance.dto';

const VOIDABLE: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
];

const BILLABLE_CONTRACT_STATUSES: ContractStatus[] = [
  ContractStatus.ACTIVE,
  ContractStatus.APPROVED,
  ContractStatus.EXPIRING,
];

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateInvoiceDto, user: AuthUser): Promise<InvoiceResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId: user.organizationId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    let contractNumber: string | null = null;
    if (dto.contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: {
          id: dto.contractId,
          organizationId: user.organizationId,
          customerId: dto.customerId,
        },
        select: { id: true, contractNumber: true, status: true },
      });
      if (!contract) {
        throw new BadRequestException(
          'Contract not found for this customer / organisation',
        );
      }
      if (!BILLABLE_CONTRACT_STATUSES.includes(contract.status)) {
        throw new BadRequestException(
          `Contract ${contract.contractNumber} must be APPROVED, ACTIVE, or EXPIRING to invoice (now ${contract.status})`,
        );
      }
      contractNumber = contract.contractNumber;
    }

    const exists = await this.prisma.invoice.findFirst({
      where: {
        organizationId: user.organizationId,
        invoiceNumber: dto.invoiceNumber,
      },
    });
    if (exists) throw new BadRequestException('Invoice number already exists');

    let subtotal = new Prisma.Decimal(0);
    const lineData = dto.lines.map((l) => {
      const amount = new Prisma.Decimal(l.quantity * l.unitPrice);
      subtotal = subtotal.add(amount);
      return {
        description: l.description,
        quantity: new Prisma.Decimal(l.quantity),
        unitPrice: new Prisma.Decimal(l.unitPrice),
        amount,
      };
    });

    const taxAmount = new Prisma.Decimal(dto.taxAmount ?? 0);
    const totalAmount = subtotal.add(taxAmount);

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: user.organizationId,
        customerId: dto.customerId,
        contractId: dto.contractId ?? null,
        invoiceNumber: dto.invoiceNumber,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        subtotal,
        taxAmount,
        totalAmount,
        currency: dto.currency ?? 'TZS',
        notes: dto.notes,
        createdBy: user.id,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'invoice.created',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      after: {
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        contractId: invoice.contractId,
        contractNumber,
      },
    });

    return this.toDto(invoice, contractNumber);
  }

  async list(
    organizationId: string,
    customerId?: string,
    contractId?: string,
  ): Promise<InvoiceResponseDto[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        ...(customerId ? { customerId } : {}),
        ...(contractId ? { contractId } : {}),
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const contractIds = [
      ...new Set(
        rows.map((r) => r.contractId).filter((id): id is string => !!id),
      ),
    ];
    const contracts =
      contractIds.length === 0
        ? []
        : await this.prisma.contract.findMany({
            where: { id: { in: contractIds }, organizationId },
            select: { id: true, contractNumber: true },
          });
    const numById = new Map(contracts.map((c) => [c.id, c.contractNumber]));
    return rows.map((i) =>
      this.toDto(i, i.contractId ? (numById.get(i.contractId) ?? null) : null),
    );
  }

  async send(id: string, user: AuthUser): Promise<InvoiceResponseDto> {
    const invoice = await this.findOrThrow(id, user.organizationId);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be sent');
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.SENT },
      include: { lines: true },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'invoice.sent',
      resourceType: 'Invoice',
      resourceId: id,
      after: updated,
    });
    return this.toDto(updated, await this.contractNumberFor(updated.contractId));
  }

  /**
   * Void unpaid DRAFT / SENT / OVERDUE invoices. Partial/paid cannot be voided
   * (use credit note later). Creator may void; audit records reason.
   */
  async void(
    id: string,
    dto: VoidInvoiceDto,
    user: AuthUser,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.findOrThrow(id, user.organizationId);
    if (!VOIDABLE.includes(invoice.status)) {
      throw new BadRequestException(
        `Only DRAFT, SENT, or OVERDUE invoices can be voided (now ${invoice.status})`,
      );
    }
    if (invoice.amountPaid.gt(0)) {
      throw new BadRequestException(
        'Cannot void an invoice with recorded payments',
      );
    }
    const reason = dto.reason?.trim() || null;
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.VOIDED,
        notes: reason
          ? [invoice.notes, `VOID: ${reason}`].filter(Boolean).join('\n')
          : invoice.notes,
      },
      include: { lines: true },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'invoice.voided',
      resourceType: 'Invoice',
      resourceId: id,
      before: { status: invoice.status },
      after: { status: updated.status, reason },
    });
    return this.toDto(
      updated,
      await this.contractNumberFor(updated.contractId),
    );
  }

  /**
   * Mark SENT / PARTIALLY_PAID invoices past due date as OVERDUE.
   */
  async scanOverdue(
    organizationId: string,
    actor: AuthUser,
  ): Promise<InvoiceScanOverdueResultDto> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const due = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: {
          in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID],
        },
        dueDate: { lt: today },
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        dueDate: true,
      },
      take: 500,
    });

    const invoiceNumbers: string[] = [];
    for (const row of due) {
      await this.prisma.invoice.update({
        where: { id: row.id },
        data: { status: InvoiceStatus.OVERDUE },
      });
      invoiceNumbers.push(row.invoiceNumber);
      await this.audit.record({
        organizationId,
        actorId: actor.id,
        action: 'invoice.status.overdue',
        resourceType: 'Invoice',
        resourceId: row.id,
        before: { status: row.status },
        after: { status: InvoiceStatus.OVERDUE, dueDate: row.dueDate },
      });
    }

    return { markedOverdue: invoiceNumbers.length, invoiceNumbers };
  }

  async recordPayment(
    id: string,
    dto: RecordInvoicePaymentDto,
    user: AuthUser,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.findOrThrow(id, user.organizationId);
    if (
      invoice.status === InvoiceStatus.VOIDED ||
      invoice.status === InvoiceStatus.PAID
    ) {
      throw new BadRequestException('Invoice cannot accept payments');
    }

    const payment = await this.prisma.invoicePayment.create({
      data: {
        organizationId: user.organizationId,
        invoiceId: id,
        amount: new Prisma.Decimal(dto.amount),
        paymentMethod: dto.paymentMethod ?? PaymentMethod.BANK_TRANSFER,
        paymentReference: dto.paymentReference,
        recordedBy: user.id,
      },
    });

    const newPaid = invoice.amountPaid.add(payment.amount);
    let status: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
    if (newPaid.gte(invoice.totalAmount)) {
      status = InvoiceStatus.PAID;
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { amountPaid: newPaid, status },
      include: { lines: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'invoice.payment.recorded',
      resourceType: 'Invoice',
      resourceId: id,
      after: { payment, invoice: updated },
    });

    return this.toDto(
      updated,
      await this.contractNumberFor(updated.contractId),
    );
  }

  async isCustomerInvoiceFullyPaid(
    customerId: string,
    organizationId: string,
  ): Promise<boolean> {
    const unpaid = await this.prisma.invoice.count({
      where: {
        organizationId,
        customerId,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
    });
    return unpaid === 0;
  }

  private async findOrThrow(id: string, organizationId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private async contractNumberFor(
    contractId: string | null,
  ): Promise<string | null> {
    if (!contractId) return null;
    const c = await this.prisma.contract.findFirst({
      where: { id: contractId },
      select: { contractNumber: true },
    });
    return c?.contractNumber ?? null;
  }

  private toDto(
    i: {
      id: string;
      organizationId: string;
      customerId: string;
      contractId: string | null;
      invoiceNumber: string;
      issueDate: Date;
      dueDate: Date;
      subtotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      amountPaid: Prisma.Decimal;
      currency: string;
      status: InvoiceStatus;
      notes: string | null;
      createdAt: Date;
      lines?: {
        id: string;
        description: string;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        amount: Prisma.Decimal;
      }[];
    },
    contractNumber: string | null = null,
  ): InvoiceResponseDto {
    return {
      id: i.id,
      organizationId: i.organizationId,
      customerId: i.customerId,
      contractId: i.contractId,
      contractNumber,
      invoiceNumber: i.invoiceNumber,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      subtotal: Number(i.subtotal),
      taxAmount: Number(i.taxAmount),
      totalAmount: Number(i.totalAmount),
      amountPaid: Number(i.amountPaid),
      currency: i.currency,
      status: i.status,
      notes: i.notes,
      lines: (i.lines ?? []).map((l) => ({
        id: l.id,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        amount: Number(l.amount),
      })),
      createdAt: i.createdAt,
    };
  }
}
