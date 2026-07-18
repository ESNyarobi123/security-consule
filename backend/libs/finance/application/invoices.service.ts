import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateInvoiceDto,
  InvoiceResponseDto,
  RecordInvoicePaymentDto,
} from '../presentation/dto/finance.dto';

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
        contractId: dto.contractId,
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
      after: invoice,
    });

    return this.toDto(invoice);
  }

  async list(
    organizationId: string,
    customerId?: string,
  ): Promise<InvoiceResponseDto[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        ...(customerId ? { customerId } : {}),
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((i) => this.toDto(i));
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
    return this.toDto(updated);
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

    return this.toDto(updated);
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

  private toDto(i: {
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
    lines?: { id: string; description: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; amount: Prisma.Decimal }[];
  }): InvoiceResponseDto {
    return {
      id: i.id,
      organizationId: i.organizationId,
      customerId: i.customerId,
      contractId: i.contractId,
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
