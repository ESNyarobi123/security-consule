import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateStockItemDto,
  CreateStockMovementDto,
  InventoryReportResponseDto,
  resolveStockCategory,
  STOCK_CATEGORIES,
  StockItemResponseDto,
  StockMovementResponseDto,
  UpdateStockItemDto,
} from '../presentation/dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createItem(
    dto: CreateStockItemDto,
    user: AuthUser,
  ): Promise<StockItemResponseDto> {
    const exists = await this.prisma.stockItem.findFirst({
      where: { organizationId: user.organizationId, sku: dto.sku },
    });
    if (exists) throw new BadRequestException('SKU already exists');

    const category = this.requireCategory(dto.category, true);

    const item = await this.prisma.stockItem.create({
      data: {
        organizationId: user.organizationId,
        sku: dto.sku,
        name: dto.name,
        category,
        unit: dto.unit ?? 'EA',
        reorderLevel: dto.reorderLevel,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'stock_item.created',
      resourceType: 'StockItem',
      resourceId: item.id,
      after: item,
    });

    return this.toItemDto(item, 0);
  }

  async updateItem(
    id: string,
    dto: UpdateStockItemDto,
    user: AuthUser,
  ): Promise<StockItemResponseDto> {
    const item = await this.prisma.stockItem.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!item) throw new NotFoundException('Stock item not found');
    const updated = await this.prisma.stockItem.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined
          ? { category: this.requireCategory(dto.category, false) }
          : {}),
        ...(dto.unit != null ? { unit: dto.unit.trim() } : {}),
        ...(dto.reorderLevel !== undefined
          ? { reorderLevel: dto.reorderLevel }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'stock_item.updated',
      resourceType: 'StockItem',
      resourceId: id,
      after: updated,
    });
    const onHand = await this.getOnHand(user.organizationId, id);
    return this.toItemDto(updated, onHand);
  }

  async listAlerts(organizationId: string): Promise<StockItemResponseDto[]> {
    const items = await this.listItems(organizationId);
    return items.filter((i) => i.belowReorder);
  }

  async listItems(organizationId: string): Promise<StockItemResponseDto[]> {
    const items = await this.prisma.stockItem.findMany({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const balances = await this.computeBalances(
      organizationId,
      items.map((i) => i.id),
    );
    return items.map((i) => this.toItemDto(i, balances.get(i.id) ?? 0));
  }

  async recordMovement(
    dto: CreateStockMovementDto,
    user: AuthUser,
  ): Promise<StockMovementResponseDto> {
    const item = await this.prisma.stockItem.findFirst({
      where: { id: dto.stockItemId, organizationId: user.organizationId },
    });
    if (!item) throw new NotFoundException('Stock item not found');

    if (dto.movementType === StockMovementType.OUT) {
      const balance = await this.getOnHand(user.organizationId, item.id);
      if (balance < dto.quantity) {
        throw new BadRequestException('Insufficient stock on hand');
      }
    }

    const movement = await this.prisma.stockMovement.create({
      data: {
        organizationId: user.organizationId,
        stockItemId: dto.stockItemId,
        siteId: dto.siteId,
        movementType: dto.movementType,
        quantity: new Prisma.Decimal(dto.quantity),
        notes: dto.notes,
        createdBy: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'stock_movement.recorded',
      resourceType: 'StockMovement',
      resourceId: movement.id,
      after: movement,
    });

    return this.toMovementDto(movement);
  }

  async listMovements(
    organizationId: string,
    stockItemId?: string,
  ): Promise<StockMovementResponseDto[]> {
    const rows = await this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        ...(stockItemId ? { stockItemId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((m) => this.toMovementDto(m));
  }

  private async getOnHand(
    organizationId: string,
    stockItemId: string,
  ): Promise<number> {
    const balances = await this.computeBalances(organizationId, [stockItemId]);
    return balances.get(stockItemId) ?? 0;
  }

  private async computeBalances(
    organizationId: string,
    stockItemIds: string[],
  ): Promise<Map<string, number>> {
    const movements = await this.prisma.stockMovement.findMany({
      where: { organizationId, stockItemId: { in: stockItemIds } },
    });
    const map = new Map<string, number>();
    for (const id of stockItemIds) map.set(id, 0);
    for (const m of movements) {
      const current = map.get(m.stockItemId) ?? 0;
      const qty = Number(m.quantity);
      if (m.movementType === StockMovementType.IN) {
        map.set(m.stockItemId, current + qty);
      } else if (m.movementType === StockMovementType.OUT) {
        map.set(m.stockItemId, current - qty);
      } else {
        map.set(m.stockItemId, qty);
      }
    }
    return map;
  }

  private toItemDto(
    item: {
      id: string;
      organizationId: string;
      sku: string;
      name: string;
      category: string | null;
      unit: string;
      reorderLevel: number | null;
      isActive: boolean;
      createdAt: Date;
    },
    onHand: number,
  ): StockItemResponseDto {
    return {
      id: item.id,
      organizationId: item.organizationId,
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      reorderLevel: item.reorderLevel,
      isActive: item.isActive,
      onHand,
      belowReorder:
        item.reorderLevel != null && onHand <= item.reorderLevel,
      createdAt: item.createdAt,
    };
  }

  private toMovementDto(m: {
    id: string;
    organizationId: string;
    stockItemId: string;
    siteId: string | null;
    movementType: StockMovementType;
    quantity: Prisma.Decimal;
    referenceType: string | null;
    referenceId: string | null;
    notes: string | null;
    createdAt: Date;
  }): StockMovementResponseDto {
    return {
      id: m.id,
      organizationId: m.organizationId,
      stockItemId: m.stockItemId,
      siteId: m.siteId,
      movementType: m.movementType,
      quantity: Number(m.quantity),
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      notes: m.notes,
      createdAt: m.createdAt,
    };
  }

  async listCategoryOptions(): Promise<{ code: string; label: string }[]> {
    return STOCK_CATEGORIES.map((code) => ({
      code,
      label: code.replaceAll('_', ' '),
    }));
  }

  async getReports(user: AuthUser): Promise<InventoryReportResponseDto> {
    const rows = await this.prisma.stockItem.findMany({
      where: { organizationId: user.organizationId },
    });
    const balances = await this.computeBalances(
      user.organizationId,
      rows.map((i) => i.id),
    );
    const items = rows.map((i) =>
      this.toItemDto(i, balances.get(i.id) ?? 0),
    );
    const byMap = new Map<string, { items: number; onHand: number }>();
    for (const i of items) {
      const key = i.category ?? 'UNCATEGORIZED';
      const cur = byMap.get(key) ?? { items: 0, onHand: 0 };
      cur.items += 1;
      cur.onHand += i.onHand;
      byMap.set(key, cur);
    }
    const pack: InventoryReportResponseDto = {
      itemsTotal: items.length,
      itemsActive: items.filter((i) => i.isActive).length,
      belowReorder: items.filter((i) => i.belowReorder).length,
      onHandUnits: items.reduce((s, i) => s + i.onHand, 0),
      byCategory: [...byMap.entries()].map(([category, v]) => ({
        category,
        items: v.items,
        onHand: v.onHand,
      })),
      notes: [
        'Serialized issued kit (radios, CCTV cameras, smartphones assigned to guards) is on /assets — not this bulk stock register.',
        'Dept→Procurement→Finance→GM matrix and auto-reorder POs are deferred.',
      ],
    };
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'inventory.reports.generated',
      resourceType: 'StockItem',
      resourceId: user.organizationId,
      after: {
        itemsTotal: pack.itemsTotal,
        belowReorder: pack.belowReorder,
      },
    });
    return pack;
  }

  private requireCategory(
    raw: string | null | undefined,
    required: boolean,
  ): string | null {
    if (raw == null || !String(raw).trim()) {
      if (required) {
        throw new BadRequestException({
          error: 'INVALID_STOCK_CATEGORY',
          message: 'Stock category is required',
        });
      }
      return null;
    }
    const resolved = resolveStockCategory(raw);
    if (!resolved) {
      throw new BadRequestException({
        error: 'INVALID_STOCK_CATEGORY',
        message: `Category must be one of: ${STOCK_CATEGORIES.join(', ')}`,
      });
    }
    return resolved;
  }
}
