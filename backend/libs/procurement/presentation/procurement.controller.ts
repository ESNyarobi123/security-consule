import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  resolveSupplierScope,
} from '@pssms/shared';
import {
  PurchaseOrdersService,
  SuppliersService,
} from '../application/procurement.service';
import {
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  GoodsReceiptResponseDto,
  PurchaseOrderResponseDto,
  SupplierResponseDto,
  ThreeWayMatchResultDto,
} from './dto/procurement.dto';

@ApiTags('Procurement — Suppliers')
@ApiBearerAuth()
@Controller('procurement/suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'Register supplier' })
  @ApiCreatedResponse({ type: SupplierResponseDto })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Current supplier profile (SUPPLIER_PORTAL users)' })
  @ApiOkResponse({ type: SupplierResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user);
  }

  @Get()
  @ApiOperation({ summary: 'List suppliers' })
  @ApiOkResponse({ type: [SupplierResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    const scoped = resolveSupplierScope(user);
    return this.service.list(user.organizationId, scoped);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve supplier' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }
}

@ApiTags('Procurement — Purchase Orders')
@ApiBearerAuth()
@Controller('procurement/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create purchase order' })
  @ApiCreatedResponse({ type: PurchaseOrderResponseDto })
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List purchase orders (supplier-portal users are force-scoped)',
  })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiOkResponse({ type: [PurchaseOrderResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('supplierId') supplierId?: string,
  ) {
    const scoped = resolveSupplierScope(user, supplierId);
    return this.service.list(user.organizationId, scoped);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit PO for approval' })
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.submitForApproval(id, user);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve purchase order' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/goods-receipts')
  @ApiOperation({ summary: 'Record goods receipt (GRN)' })
  @ApiCreatedResponse({ type: GoodsReceiptResponseDto })
  createGrn(
    @Param('id') id: string,
    @Body() dto: CreateGoodsReceiptDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createGoodsReceipt(
      { ...dto, purchaseOrderId: id },
      user,
    );
  }

  @Get(':id/three-way-match')
  @ApiOperation({ summary: '3-way match: PO vs received vs payable' })
  @ApiOkResponse({ type: ThreeWayMatchResultDto })
  threeWayMatch(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.threeWayMatch(id, user.organizationId);
  }
}
