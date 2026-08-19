import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchaseOrderStatus,
  PurchaseRequestQuoteStatus,
  PurchaseRequestStatus,
  SupplierPaymentStatus,
  SupplierStatus,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import { AuthUser, PrismaService } from '@pssms/shared';
import {
  CreatePurchaseRequestDto,
  CreatePurchaseRequestQuoteDto,
  ProcurementReportResponseDto,
  PurchaseOrderResponseDto,
  RejectPurchaseRequestDto,
} from '../presentation/dto/procurement.dto';
import { PurchaseOrdersService } from './procurement.service';

export type PurchaseRequestDto = {
  id: string;
  organizationId: string;
  requestNumber: string;
  department: string;
  purpose: string;
  status: PurchaseRequestStatus;
  currency: string;
  approvalInstanceId: string | null;
  awardedQuoteId: string | null;
  purchaseOrderId: string | null;
  poNumber: string | null;
  createdBy: string;
  createdAt: Date;
  lines: {
    id: string;
    stockItemId: string | null;
    stockSku: string | null;
    description: string;
    quantity: number;
    unit: string;
  }[];
  quotes: {
    id: string;
    supplierId: string;
    supplierCode: string | null;
    supplierName: string | null;
    status: PurchaseRequestQuoteStatus;
    totalAmount: number;
    currency: string;
    notes: string | null;
    createdBy: string;
    createdAt: Date;
    lines: {
      id: string;
      purchaseRequestLineId: string;
      unitPrice: number;
      amount: number;
    }[];
  }[];
};

@Injectable()
export class PurchaseRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly purchaseOrders: PurchaseOrdersService,
  ) {}

  async create(
    dto: CreatePurchaseRequestDto,
    user: AuthUser,
  ): Promise<PurchaseRequestDto> {
    this.assertStaff(user);
    if (!dto.lines?.length) {
      throw new BadRequestException('At least one line is required');
    }
    await this.assertStockItems(
      user.organizationId,
      dto.lines.map((l) => l.stockItemId),
    );
    const requestNumber = await this.nextNumber(user.organizationId);
    const row = await this.prisma.purchaseRequest.create({
      data: {
        organizationId: user.organizationId,
        requestNumber,
        department: dto.department.trim(),
        purpose: dto.purpose.trim(),
        currency: dto.currency?.trim() || 'TZS',
        createdBy: user.id,
        lines: {
          create: dto.lines.map((l) => ({
            description: l.description.trim(),
            quantity: new Prisma.Decimal(l.quantity),
            unit: l.unit?.trim() || 'EA',
            stockItemId: l.stockItemId || null,
          })),
        },
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'purchase_request.created',
      resourceType: 'PurchaseRequest',
      resourceId: row.id,
      after: { requestNumber, department: row.department },
    });
    return this.get(row.id, user.organizationId);
  }

  async list(organizationId: string): Promise<PurchaseRequestDto[]> {
    const rows = await this.prisma.purchaseRequest.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true },
    });
    const out: PurchaseRequestDto[] = [];
    for (const r of rows) {
      out.push(await this.get(r.id, organizationId));
    }
    return out;
  }

  async submit(id: string, user: AuthUser): Promise<PurchaseRequestDto> {
    this.assertStaff(user);
    const pr = await this.findOrThrow(id, user.organizationId);
    if (pr.status !== PurchaseRequestStatus.DRAFT) {
      throw new BadRequestException('Only draft purchase requests can be submitted');
    }
    const approval = await this.approvals.start(
      {
        workflowCode: 'purchase-request-approval',
        resourceType: 'PurchaseRequest',
        resourceId: pr.id,
      },
      user,
    );
    await this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: PurchaseRequestStatus.PENDING_APPROVAL,
        approvalInstanceId: approval.id,
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'purchase_request.submitted',
      resourceType: 'PurchaseRequest',
      resourceId: id,
    });
    return this.get(id, user.organizationId);
  }

  async approve(id: string, user: AuthUser): Promise<PurchaseRequestDto> {
    this.assertStaff(user);
    const pr = await this.findOrThrow(id, user.organizationId);
    if (pr.status !== PurchaseRequestStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Purchase request is not pending approval');
    }
    if (!pr.approvalInstanceId) {
      throw new BadRequestException('No approval instance');
    }
    this.assertCreatorNotActor(pr.createdBy, user, 'approve');
    await this.approvals.act(
      pr.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );
    await this.prisma.purchaseRequest.update({
      where: { id },
      data: { status: PurchaseRequestStatus.APPROVED },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'purchase_request.approved',
      resourceType: 'PurchaseRequest',
      resourceId: id,
    });
    return this.get(id, user.organizationId);
  }

  async reject(
    id: string,
    dto: RejectPurchaseRequestDto,
    user: AuthUser,
  ): Promise<PurchaseRequestDto> {
    this.assertStaff(user);
    const pr = await this.findOrThrow(id, user.organizationId);
    if (pr.status !== PurchaseRequestStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Purchase request is not pending approval');
    }
    this.assertCreatorNotActor(pr.createdBy, user, 'reject');
    if (pr.approvalInstanceId) {
      await this.approvals.act(
        pr.approvalInstanceId,
        { decision: 'REJECT', remarks: dto.reason },
        user,
      );
    }
    await this.prisma.purchaseRequest.update({
      where: { id },
      data: { status: PurchaseRequestStatus.REJECTED },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'purchase_request.rejected',
      resourceType: 'PurchaseRequest',
      resourceId: id,
      after: { reason: dto.reason },
    });
    return this.get(id, user.organizationId);
  }

  async addQuote(
    id: string,
    dto: CreatePurchaseRequestQuoteDto,
    user: AuthUser,
  ): Promise<PurchaseRequestDto> {
    this.assertStaff(user);
    const pr = await this.findOrThrow(id, user.organizationId);
    if (
      pr.status !== PurchaseRequestStatus.DRAFT &&
      pr.status !== PurchaseRequestStatus.PENDING_APPROVAL &&
      pr.status !== PurchaseRequestStatus.APPROVED
    ) {
      throw new BadRequestException('Cannot add quotes to this request');
    }
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, organizationId: user.organizationId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (supplier.status !== SupplierStatus.APPROVED) {
      throw new BadRequestException('Supplier must be approved');
    }
    const existing = await this.prisma.purchaseRequestQuote.findFirst({
      where: { purchaseRequestId: id, supplierId: dto.supplierId },
    });
    if (existing) {
      throw new BadRequestException({
        error: 'QUOTE_EXISTS',
        message: 'This supplier already has a quote on the request',
      });
    }
    const lines = pr.lines;
    if (!dto.lines?.length || dto.lines.length !== lines.length) {
      throw new BadRequestException('Quote must price every request line');
    }
    const lineIds = new Set(lines.map((l) => l.id));
    let total = new Prisma.Decimal(0);
    const quoteLines = dto.lines.map((ql) => {
      if (!lineIds.has(ql.purchaseRequestLineId)) {
        throw new BadRequestException('Quote line does not belong to this request');
      }
      const reqLine = lines.find((l) => l.id === ql.purchaseRequestLineId)!;
      const amount = reqLine.quantity.mul(new Prisma.Decimal(ql.unitPrice));
      total = total.add(amount);
      return {
        purchaseRequestLineId: ql.purchaseRequestLineId,
        unitPrice: new Prisma.Decimal(ql.unitPrice),
        amount,
      };
    });
    const quote = await this.prisma.purchaseRequestQuote.create({
      data: {
        organizationId: user.organizationId,
        purchaseRequestId: id,
        supplierId: dto.supplierId,
        totalAmount: total,
        currency: pr.currency,
        notes: dto.notes?.trim() || null,
        createdBy: user.id,
        lines: { create: quoteLines },
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'purchase_request.quote_added',
      resourceType: 'PurchaseRequest',
      resourceId: id,
      after: { quoteId: quote.id, supplierId: dto.supplierId, total: Number(total) },
    });
    return this.get(id, user.organizationId);
  }

  async awardQuote(
    id: string,
    quoteId: string,
    user: AuthUser,
  ): Promise<PurchaseRequestDto> {
    this.assertStaff(user);
    const pr = await this.findOrThrow(id, user.organizationId);
    if (pr.status !== PurchaseRequestStatus.APPROVED) {
      throw new BadRequestException({
        error: 'NOT_APPROVED',
        message: 'Approve the purchase request before awarding a quote',
      });
    }
    const quotes = await this.prisma.purchaseRequestQuote.findMany({
      where: { purchaseRequestId: id, organizationId: user.organizationId },
    });
    if (quotes.length < 2) {
      throw new BadRequestException({
        error: 'COMPARISON_REQUIRED',
        message: 'Add at least two supplier quotes before awarding',
      });
    }
    const winner = quotes.find((q) => q.id === quoteId);
    if (!winner) throw new NotFoundException('Quote not found');
    this.assertCreatorNotActor(winner.createdBy, user, 'award');
    await this.prisma.$transaction([
      this.prisma.purchaseRequestQuote.updateMany({
        where: { purchaseRequestId: id },
        data: { status: PurchaseRequestQuoteStatus.NOT_SELECTED },
      }),
      this.prisma.purchaseRequestQuote.update({
        where: { id: quoteId },
        data: { status: PurchaseRequestQuoteStatus.AWARDED },
      }),
      this.prisma.purchaseRequest.update({
        where: { id },
        data: { awardedQuoteId: quoteId },
      }),
    ]);
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'purchase_request.quote_awarded',
      resourceType: 'PurchaseRequest',
      resourceId: id,
      after: { quoteId, supplierId: winner.supplierId },
    });
    return this.get(id, user.organizationId);
  }

  async convertToPo(
    id: string,
    user: AuthUser,
  ): Promise<{ request: PurchaseRequestDto; purchaseOrder: PurchaseOrderResponseDto }> {
    this.assertStaff(user);
    const pr = await this.findOrThrow(id, user.organizationId);
    if (pr.status !== PurchaseRequestStatus.APPROVED) {
      throw new BadRequestException('Purchase request must be approved');
    }
    if (!pr.awardedQuoteId) {
      throw new BadRequestException({
        error: 'NO_AWARDED_QUOTE',
        message: 'Award a compared quote before raising a purchase order',
      });
    }
    const existingPo = await this.prisma.purchaseOrder.findFirst({
      where: { purchaseRequestId: id, organizationId: user.organizationId },
    });
    if (existingPo) {
      throw new BadRequestException({
        error: 'ALREADY_CONVERTED',
        message: 'A purchase order already exists for this request',
      });
    }
    const quote = await this.prisma.purchaseRequestQuote.findFirst({
      where: {
        id: pr.awardedQuoteId,
        purchaseRequestId: id,
        status: PurchaseRequestQuoteStatus.AWARDED,
      },
      include: { lines: true },
    });
    if (!quote) throw new NotFoundException('Awarded quote not found');
    const priceByLine = new Map(
      quote.lines.map((l) => [l.purchaseRequestLineId, l]),
    );
    const poNumber = `PO-${pr.requestNumber.replace(/^PR-/, '')}`;
    let po: PurchaseOrderResponseDto;
    try {
      po = await this.purchaseOrders.create(
        {
          supplierId: quote.supplierId,
          poNumber,
          currency: pr.currency,
          lines: pr.lines.map((l) => {
            const ql = priceByLine.get(l.id);
            if (!ql) {
              throw new BadRequestException('Awarded quote is missing a line');
            }
            return {
              description: l.description,
              quantity: Number(l.quantity),
              unitPrice: Number(ql.unitPrice),
              stockItemId: l.stockItemId ?? undefined,
            };
          }),
        },
        user,
        { purchaseRequestId: id },
      );
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException({
          error: 'ALREADY_CONVERTED',
          message: 'A purchase order already exists for this request',
        });
      }
      throw err;
    }
    const marked = await this.prisma.purchaseRequest.updateMany({
      where: {
        id,
        organizationId: user.organizationId,
        status: PurchaseRequestStatus.APPROVED,
      },
      data: { status: PurchaseRequestStatus.CONVERTED },
    });
    if (marked.count === 0) {
      throw new BadRequestException({
        error: 'ALREADY_CONVERTED',
        message: 'Purchase request was already converted',
      });
    }
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'purchase_request.converted',
      resourceType: 'PurchaseRequest',
      resourceId: id,
      after: { purchaseOrderId: po.id, poNumber: po.poNumber },
    });
    return {
      request: await this.get(id, user.organizationId),
      purchaseOrder: po,
    };
  }

  private async get(
    id: string,
    organizationId: string,
  ): Promise<PurchaseRequestDto> {
    const pr = await this.prisma.purchaseRequest.findFirst({
      where: { id, organizationId },
      include: {
        lines: true,
        quotes: { include: { lines: true }, orderBy: { createdAt: 'asc' } },
        purchaseOrder: { select: { id: true, poNumber: true } },
      },
    });
    if (!pr) throw new NotFoundException('Purchase request not found');
    const stockIds = [
      ...new Set(pr.lines.map((l) => l.stockItemId).filter((x): x is string => !!x)),
    ];
    const supplierIds = [...new Set(pr.quotes.map((q) => q.supplierId))];
    const [items, suppliers] = await Promise.all([
      stockIds.length
        ? this.prisma.stockItem.findMany({
            where: { id: { in: stockIds } },
            select: { id: true, sku: true },
          })
        : [],
      supplierIds.length
        ? this.prisma.supplier.findMany({
            where: { id: { in: supplierIds } },
            select: { id: true, code: true, name: true },
          })
        : [],
    ]);
    const skuById = new Map(items.map((i) => [i.id, i.sku]));
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));
    const po = pr.purchaseOrder;
    return {
      id: pr.id,
      organizationId: pr.organizationId,
      requestNumber: pr.requestNumber,
      department: pr.department,
      purpose: pr.purpose,
      status: pr.status,
      currency: pr.currency,
      approvalInstanceId: pr.approvalInstanceId,
      awardedQuoteId: pr.awardedQuoteId,
      purchaseOrderId: po?.id ?? null,
      poNumber: po?.poNumber ?? null,
      createdBy: pr.createdBy,
      createdAt: pr.createdAt,
      lines: pr.lines.map((l) => ({
        id: l.id,
        stockItemId: l.stockItemId,
        stockSku: l.stockItemId ? skuById.get(l.stockItemId) ?? null : null,
        description: l.description,
        quantity: Number(l.quantity),
        unit: l.unit,
      })),
      quotes: pr.quotes.map((q) => {
        const s = supplierById.get(q.supplierId);
        return {
          id: q.id,
          supplierId: q.supplierId,
          supplierCode: s?.code ?? null,
          supplierName: s?.name ?? null,
          status: q.status,
          totalAmount: Number(q.totalAmount),
          currency: q.currency,
          notes: q.notes,
          createdBy: q.createdBy,
          createdAt: q.createdAt,
          lines: q.lines.map((ql) => ({
            id: ql.id,
            purchaseRequestLineId: ql.purchaseRequestLineId,
            unitPrice: Number(ql.unitPrice),
            amount: Number(ql.amount),
          })),
        };
      }),
    };
  }

  private async findOrThrow(id: string, organizationId: string) {
    const pr = await this.prisma.purchaseRequest.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });
    if (!pr) throw new NotFoundException('Purchase request not found');
    return pr;
  }

  private async nextNumber(organizationId: string): Promise<string> {
    const count = await this.prisma.purchaseRequest.count({
      where: { organizationId },
    });
    const ymd = new Date().toISOString().slice(0, 7).replace('-', '');
    return `PR-${ymd}-${String(count + 1).padStart(4, '0')}`;
  }

  private async assertStockItems(
    organizationId: string,
    ids: Array<string | undefined>,
  ) {
    const wanted = [...new Set(ids.filter((x): x is string => !!x))];
    if (!wanted.length) return;
    const found = await this.prisma.stockItem.findMany({
      where: { organizationId, id: { in: wanted }, isActive: true },
      select: { id: true },
    });
    if (found.length !== wanted.length) {
      throw new BadRequestException({
        error: 'INVALID_STOCK_ITEM',
        message: 'One or more stock items are invalid',
      });
    }
  }

  private assertStaff(user: AuthUser) {
    if (user.supplierId) {
      throw new ForbiddenException({
        error: 'SUPPLIER_SCOPE_DENIED',
        message: 'Supplier portal users cannot manage purchase requests',
      });
    }
  }

  private assertCreatorNotActor(
    createdBy: string | null,
    user: AuthUser,
    verb: string,
  ) {
    if (
      createdBy &&
      createdBy === user.id &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException({
        error: 'CREATOR_CANNOT_APPROVE',
        message: `The officer who created this record cannot ${verb} it`,
      });
    }
  }

  async getReports(user: AuthUser): Promise<ProcurementReportResponseDto> {
    this.assertStaff(user);
    const org = user.organizationId;
    const [
      suppliers,
      prByStatus,
      poByStatus,
      goodsReceiptsTotal,
      submissionsUnpaid,
    ] = await Promise.all([
      this.prisma.supplier.groupBy({
        by: ['status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.purchaseRequest.groupBy({
        by: ['status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { organizationId: org },
        _count: { _all: true },
      }),
      this.prisma.goodsReceipt.count({ where: { organizationId: org } }),
      this.prisma.supplierSubmission.count({
        where: {
          organizationId: org,
          paymentStatus: SupplierPaymentStatus.UNPAID,
        },
      }),
    ]);

    const supplierMap = Object.fromEntries(
      suppliers.map((s) => [s.status, s._count._all]),
    );
    const prRows = prByStatus.map((s) => ({
      status: s.status,
      count: s._count._all,
    }));
    const poRows = poByStatus.map((s) => ({
      status: s.status,
      count: s._count._all,
    }));
    const poMap = Object.fromEntries(poRows.map((r) => [r.status, r.count]));
    const prMap = Object.fromEntries(prRows.map((r) => [r.status, r.count]));

    const openPo =
      (poMap[PurchaseOrderStatus.DRAFT] ?? 0) +
      (poMap[PurchaseOrderStatus.PENDING_APPROVAL] ?? 0) +
      (poMap[PurchaseOrderStatus.APPROVED] ?? 0) +
      (poMap[PurchaseOrderStatus.ORDERED] ?? 0) +
      (poMap[PurchaseOrderStatus.PARTIALLY_RECEIVED] ?? 0);

    const pack: ProcurementReportResponseDto = {
      suppliersTotal: Object.values(supplierMap).reduce((a, b) => a + b, 0),
      suppliersPending: supplierMap[SupplierStatus.PENDING] ?? 0,
      suppliersApproved: supplierMap[SupplierStatus.APPROVED] ?? 0,
      purchaseRequestsTotal: prRows.reduce((a, r) => a + r.count, 0),
      purchaseRequestsPendingApproval:
        prMap[PurchaseRequestStatus.PENDING_APPROVAL] ?? 0,
      purchaseRequestsApproved: prMap[PurchaseRequestStatus.APPROVED] ?? 0,
      purchaseOrdersOpen: openPo,
      purchaseOrdersReceived: poMap[PurchaseOrderStatus.RECEIVED] ?? 0,
      goodsReceiptsTotal,
      submissionsUnpaid,
      purchaseRequestsByStatus: prRows,
      purchaseOrdersByStatus: poRows,
      notes: [
        'Vendors use supplier-web (Portal 35.17). Finance AP payment vouchers stay on Portal 35.15.',
        'PR/PO approval is GM today (Dept→Procurement→Finance→GM matrix deferred).',
        'Issued serialized assets are on /assets (storekeeper).',
      ],
    };

    await this.audit.record({
      organizationId: org,
      actorId: user.id,
      action: 'procurement.reports.generated',
      resourceType: 'PurchaseRequest',
      resourceId: org,
      after: {
        suppliersTotal: pack.suppliersTotal,
        purchaseRequestsTotal: pack.purchaseRequestsTotal,
        goodsReceiptsTotal: pack.goodsReceiptsTotal,
      },
    });
    return pack;
  }
}
