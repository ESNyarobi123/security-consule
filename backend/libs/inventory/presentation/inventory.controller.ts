import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { InventoryService } from '../application/inventory.service';
import {
  CreateStockItemDto,
  CreateStockMovementDto,
  StockItemResponseDto,
  StockMovementResponseDto,
} from './dto/inventory.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post('items')
  @ApiOperation({ summary: 'Create stock item' })
  @ApiCreatedResponse({ type: StockItemResponseDto })
  createItem(@Body() dto: CreateStockItemDto, @CurrentUser() user: AuthUser) {
    return this.service.createItem(dto, user);
  }

  @Get('items')
  @ApiOperation({ summary: 'List stock items with on-hand balance' })
  @ApiOkResponse({ type: [StockItemResponseDto] })
  listItems(@CurrentUser() user: AuthUser) {
    return this.service.listItems(user.organizationId);
  }

  @Post('movements')
  @ApiOperation({ summary: 'Record stock movement (IN/OUT/ADJUST)' })
  @ApiCreatedResponse({ type: StockMovementResponseDto })
  recordMovement(
    @Body() dto: CreateStockMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordMovement(dto, user);
  }

  @Get('movements')
  @ApiOperation({ summary: 'List stock movements' })
  @ApiQuery({ name: 'stockItemId', required: false })
  @ApiOkResponse({ type: [StockMovementResponseDto] })
  listMovements(
    @CurrentUser() user: AuthUser,
    @Query('stockItemId') stockItemId?: string,
  ) {
    return this.service.listMovements(user.organizationId, stockItemId);
  }
}
