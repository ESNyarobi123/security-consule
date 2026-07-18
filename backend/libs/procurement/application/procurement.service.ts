import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PurchaseOrderStatus,
  Prisma,
  StockMovementType,
  SupplierStatus,
} from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  requireSupplierScope,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { ApprovalsService } from '@pssms/approvals';
import {
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  GoodsReceiptResponseDto,
  PurchaseOrderResponseDto,
  SupplierResponseDto,
  ThreeWayMatchResultDto,
} from '../presentation/dto/procurement.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateSupplierDto,
    user: AuthUser,
  ): Promise<SupplierResponseDto> {
    if (user.supplierId) {
      throw new ForbiddenException({
        error: 'SUPPLIER_SCOPE_DENIED',
        message: 'Supplier portal users cannot create suppliers',
      });
    }

    const exists = await this.prisma.supplier.findFirst({
      where: { organizationId: user.organizationId, code: dto.code },
    });
    if (exists) throw new BadRequestException('Supplier code already exists');

    const supplier = await this.prisma.supplier.create({
      data: {
        organizationId: user.organizationId,
        code: dto.code,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        tin: dto.tin,
        address: dto.address,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.created',
      resourceType: 'Supplier',
      resourceId: supplier.id,
      after: supplier,
    });

    return this.toDto(supplier);
  }

  async me(user: AuthUser): Promise<SupplierResponseDto> {
    const supplierId = requireSupplierScope(user);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: user.organizationId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return this.toDto(supplier);
  }

  async list(
    organizationId: string,
    supplierId?: string,
  ): Promise<SupplierResponseDto[]> {
    const rows = await this.prisma.supplier.findMany({
      where: {
        organizationId,
        ...(supplierId ? { id: supplierId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((s) => this.toDto(s));
  }

  async approve(id: string, user: AuthUser): Promise<SupplierResponseDto> {
    const supplier = await this.findOrThrow(id, user.organizationId);
    if (supplier.status === SupplierStatus.APPROVED) {
      throw new BadRequestException('Supplier already approved');
    }
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { status: SupplierStatus.APPROVED },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'supplier.approved',
      resourceType: 'Supplier',
      resourceId: id,
      after: updated,
    });
    return this.toDto(updated);
  }

  private async findOrThrow(id: string, organizationId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  private toDto(s: {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    tin: string | null;
    address: string | null;
    status: SupplierStatus;
    createdAt: Date;
  }): SupplierResponseDto {
    return {
      id: s.id,
      organizationId: s.organizationId,
      code: s.code,
      name: s.name,
      email: s.email,
      phone: s.phone,
      tin: s.tin,
      address: s.address,
      status: s.status,
      createdAt: s.createdAt,
    };
  }
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
  ) {}

  async create(
    dto: CreatePurchaseOrderDto,
    user: AuthUser,
  ): Promise<PurchaseOrderResponseDto> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, organizationId: user.organizationId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (supplier.status !== SupplierStatus.APPROVED) {
      throw new BadRequestException('Supplier must be approved');
    }

    const exists = await this.prisma.purchaseOrder.findFirst({
      where: { organizationId: user.organizationId, poNumber: dto.poNumber },
    });
    if (exists) throw new BadRequestException('PO number already exists');

    let totalAmount = new Prisma.Decimal(0);
    const lineData = dto.lines.map((l) => {
      const amount = new Prisma.Decimal(l.quantity * l.unitPrice);
      totalAmount = totalAmount.add(amount);
      return {
        description: l.description,
        quantity: new Prisma.Decimal(l.quantity),
        unitPrice: new Prisma.Decimal(l.unitPrice),
        amount,
        stockItemId: l.stockItemId,
      };
    });

    const po = await this.prisma.purchaseOrder.create({
      data: {
        organizationId: user.organizationId,
        supplierId: dto.supplierId,
        poNumber: dto.poNumber,
        totalAmount,
        currency: dto.currency ?? 'TZS',
        expectedDelivery: dto.expectedDelivery
          ? new Date(dto.expectedDelivery)
          : undefined,
        createdBy: user.id,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'purchase_order.created',
      resourceType: 'PurchaseOrder',
      resourceId: po.id,
      after: po,
    });

    return this.toDto(po);
  }

  async list(
    organizationId: string,
    supplierId?: string,
  ): Promise<PurchaseOrderResponseDto[]> {
    const rows = await this.prisma.purchaseOrder.findMany({
      where: {
        organizationId,
        ...(supplierId ? { supplierId } : {}),
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((p) => this.toDto(p));
  }

  async submitForApproval(
    id: string,
    user: AuthUser,
  ): Promise<PurchaseOrderResponseDto> {
    const po = await this.findOrThrow(id, user.organizationId);
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft POs can be submitted');
    }

    const approval = await this.approvals.start(
      {
        workflowCode: 'purchase-order-approval',
        resourceType: 'PurchaseOrder',
        resourceId: po.id,
        amount: Number(po.totalAmount),
      },
      user,
    );

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.PENDING_APPROVAL,
        approvalInstanceId: approval.id,
      },
      include: { lines: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'purchase_order.submitted',
      resourceType: 'PurchaseOrder',
      resourceId: id,
      after: updated,
    });

    return this.toDto(updated);
  }

  async approve(id: string, user: AuthUser): Promise<PurchaseOrderResponseDto> {
    const po = await this.findOrThrow(id, user.organizationId);
    if (!po.approvalInstanceId) {
      throw new BadRequestException('No approval instance');
    }

    await this.approvals.act(
      po.approvalInstanceId,
      { decision: 'APPROVE' },
      user,
    );

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.ORDERED,
        approvedBy: user.id,
      },
      include: { lines: true },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'purchase_order.approved',
      resourceType: 'PurchaseOrder',
      resourceId: id,
      after: updated,
    });

    return this.toDto(updated);
  }

  async createGoodsReceipt(
    dto: CreateGoodsReceiptDto,
    user: AuthUser,
  ): Promise<GoodsReceiptResponseDto> {
    const po = await this.findOrThrow(dto.purchaseOrderId, user.organizationId);
    if (
      po.status !== PurchaseOrderStatus.ORDERED &&
      po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException('PO must be ordered before receiving goods');
    }

    const grnNumber = await this.nextGrnNumber(user.organizationId);

    const result = await this.prisma.$transaction(async (tx) => {
      const grn = await tx.goodsReceipt.create({
        data: {
          organizationId: user.organizationId,
          purchaseOrderId: po.id,
          grnNumber,
          receivedBy: user.id,
          notes: dto.notes,
          lines: {
            create: dto.lines.map((l) => ({
              purchaseOrderLineId: l.purchaseOrderLineId,
              quantityReceived: new Prisma.Decimal(l.quantityReceived),
            })),
          },
        },
      });

      for (const line of dto.lines) {
        const poLine = po.lines.find((l) => l.id === line.purchaseOrderLineId);
        if (!poLine) {
          throw new BadRequestException(
            `PO line ${line.purchaseOrderLineId} not found`,
          );
        }
        const newReceived = poLine.receivedQty.add(
          new Prisma.Decimal(line.quantityReceived),
        );
        if (newReceived.gt(poLine.quantity)) {
          throw new BadRequestException(
            `Received qty exceeds ordered for line ${poLine.description}`,
          );
        }
        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: { receivedQty: newReceived },
        });

        if (poLine.stockItemId) {
          await tx.stockMovement.create({
            data: {
              organizationId: user.organizationId,
              stockItemId: poLine.stockItemId,
              movementType: StockMovementType.IN,
              quantity: new Prisma.Decimal(line.quantityReceived),
              referenceType: 'GoodsReceipt',
              referenceId: grn.id,
              notes: `GRN ${grnNumber}`,
              createdBy: user.id,
            },
          });
        }
      }

      const refreshed = await tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: { lines: true },
      });
      const allReceived = refreshed!.lines.every((l) =>
        l.receivedQty.gte(l.quantity),
      );
      const anyReceived = refreshed!.lines.some((l) =>
        l.receivedQty.gt(0),
      );

      let status: PurchaseOrderStatus = po.status;
      if (allReceived) status = PurchaseOrderStatus.RECEIVED;
      else if (anyReceived) status = PurchaseOrderStatus.PARTIALLY_RECEIVED;

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status },
      });

      return grn;
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'goods_receipt.created',
      resourceType: 'GoodsReceipt',
      resourceId: result.id,
      after: result,
    });

    return {
      id: result.id,
      organizationId: result.organizationId,
      purchaseOrderId: result.purchaseOrderId,
      grnNumber: result.grnNumber,
      receivedAt: result.receivedAt,
      notes: result.notes,
      createdAt: result.createdAt,
    };
  }

  async threeWayMatch(
    id: string,
    organizationId: string,
  ): Promise<ThreeWayMatchResultDto> {
    const po = await this.findOrThrow(id, organizationId);
    const receipts = await this.prisma.goodsReceipt.findMany({
      where: { purchaseOrderId: id, organizationId },
      include: { lines: true },
    });

    let receivedValue = new Prisma.Decimal(0);
    for (const line of po.lines) {
      receivedValue = receivedValue.add(
        line.receivedQty.mul(line.unitPrice),
      );
    }

    const poTotal = po.totalAmount;
    const payableAmount = receivedValue;
    const discrepancies: string[] = [];

    for (const line of po.lines) {
      if (line.receivedQty.lt(line.quantity)) {
        discrepancies.push(
          `${line.description}: ordered ${line.quantity}, received ${line.receivedQty}`,
        );
      }
    }

    if (!receivedValue.eq(poTotal) && po.lines.every((l) => l.receivedQty.gte(l.quantity))) {
      discrepancies.push(
        `PO total ${poTotal} vs received value ${receivedValue}`,
      );
    }

  const matched =
      discrepancies.length === 0 &&
      receivedValue.gt(0) &&
      (po.status === PurchaseOrderStatus.RECEIVED ||
        po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED);

    return {
      purchaseOrderId: po.id,
      poNumber: po.poNumber,
      poTotal: Number(poTotal),
      receivedValue: Number(receivedValue),
      payableAmount: Number(payableAmount),
      matched,
      discrepancies,
    };
  }

  private async findOrThrow(id: string, organizationId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  private async nextGrnNumber(organizationId: string): Promise<string> {
    const count = await this.prisma.goodsReceipt.count({
      where: { organizationId },
    });
    return `GRN-${String(count + 1).padStart(5, '0')}`;
  }

  private toDto(po: {
    id: string;
    organizationId: string;
    supplierId: string;
    poNumber: string;
    status: PurchaseOrderStatus;
    totalAmount: Prisma.Decimal;
    currency: string;
    expectedDelivery: Date | null;
    approvalInstanceId: string | null;
    createdAt: Date;
    lines?: {
      id: string;
      description: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      amount: Prisma.Decimal;
      receivedQty: Prisma.Decimal;
      stockItemId: string | null;
    }[];
  }): PurchaseOrderResponseDto {
    return {
      id: po.id,
      organizationId: po.organizationId,
      supplierId: po.supplierId,
      poNumber: po.poNumber,
      status: po.status,
      totalAmount: Number(po.totalAmount),
      currency: po.currency,
      expectedDelivery: po.expectedDelivery,
      approvalInstanceId: po.approvalInstanceId,
      lines: (po.lines ?? []).map((l) => ({
        id: l.id,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        amount: Number(l.amount),
        receivedQty: Number(l.receivedQty),
        stockItemId: l.stockItemId,
      })),
      createdAt: po.createdAt,
    };
  }
}
