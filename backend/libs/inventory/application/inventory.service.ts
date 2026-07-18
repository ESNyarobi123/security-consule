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
  StockItemResponseDto,
  StockMovementResponseDto,
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

    const item = await this.prisma.stockItem.create({
      data: {
        organizationId: user.organizationId,
        sku: dto.sku,
        name: dto.name,
        category: dto.category,
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
}
