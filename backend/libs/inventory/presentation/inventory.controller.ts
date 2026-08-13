import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
} from '@pssms/shared';
import { InventoryService } from '../application/inventory.service';
import {
  CreateStockItemDto,
  CreateStockMovementDto,
  StockItemResponseDto,
  StockMovementResponseDto,
  UpdateStockItemDto,
} from './dto/inventory.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('inventory.manage')
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

  @Get('alerts')
  @ApiOperation({
    summary: 'Stock items at or below reorder level',
  })
  @ApiOkResponse({ type: [StockItemResponseDto] })
  listAlerts(@CurrentUser() user: AuthUser) {
    return this.service.listAlerts(user.organizationId);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update stock item (reorder level, category, active)' })
  @ApiOkResponse({ type: StockItemResponseDto })
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateStockItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateItem(id, dto, user);
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
