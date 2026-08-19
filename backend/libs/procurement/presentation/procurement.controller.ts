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
  Public,
  RequireAnyPermissions,
  RequirePermissions,
  resolveSupplierScope,
} from '@pssms/shared';
import { PurchaseOrdersService } from '../application/procurement.service';
import { PurchaseRequestsService } from '../application/purchase-requests.service';
import { SuppliersService } from '../application/suppliers.service';
import {
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
  CreatePurchaseRequestDto,
  CreatePurchaseRequestQuoteDto,
  CreateSupplierDto,
  CreateSupplierMessageDto,
  CreateSupplierSubmissionDto,
  GoodsReceiptResponseDto,
  ProcurementReportResponseDto,
  PurchaseOrderResponseDto,
  RegisterSupplierDto,
  RegisterSupplierResponseDto,
  RejectPurchaseRequestDto,
  RejectSupplierDto,
  RejectSupplierSubmissionDto,
  SupplierResponseDto,
  SupplierMessageResponseDto,
  SupplierSubmissionResponseDto,
  ThreeWayMatchResultDto,
  UpdateSupplierProfileDto,
} from './dto/procurement.dto';

@ApiTags('Procurement — Suppliers')
@Controller('procurement/suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary:
      'Public self-register (PENDING until procurement approves). Creates SUPPLIER_PORTAL login.',
  })
  @ApiCreatedResponse({ type: RegisterSupplierResponseDto })
  register(@Body() dto: RegisterSupplierDto) {
    return this.service.register(dto);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Post()
  @ApiOperation({ summary: 'Staff — register supplier (PENDING until approved)' })
  @ApiCreatedResponse({ type: SupplierResponseDto })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Get('me')
  @ApiOperation({ summary: 'Current supplier profile (SUPPLIER_PORTAL)' })
  @ApiOkResponse({ type: SupplierResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Patch('me')
  @ApiOperation({
    summary: 'Supplier portal — update own company / bank / contact details',
  })
  @ApiOkResponse({ type: SupplierResponseDto })
  updateMe(
    @Body() dto: UpdateSupplierProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateMe(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Get('me/submissions')
  @ApiOperation({
    summary: 'Supplier portal — own quotes, invoices, DNs, payment requests',
  })
  @ApiOkResponse({ type: [SupplierSubmissionResponseDto] })
  mySubmissions(@CurrentUser() user: AuthUser) {
    return this.service.listMySubmissions(user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Post('me/submissions')
  @ApiOperation({
    summary:
      'Supplier portal — submit quotation / invoice / delivery note / payment request (approved suppliers only)',
  })
  @ApiCreatedResponse({ type: SupplierSubmissionResponseDto })
  createMySubmission(
    @Body() dto: CreateSupplierSubmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createSubmission(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Get('me/messages')
  @ApiOperation({
    summary: 'Supplier portal — own thread with HIGHLINK procurement',
  })
  @ApiOkResponse({ type: [SupplierMessageResponseDto] })
  myMessages(@CurrentUser() user: AuthUser) {
    return this.service.listMyMessages(user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Post('me/messages')
  @ApiOperation({
    summary: 'Supplier portal — post a message to procurement (own supplier)',
  })
  @ApiCreatedResponse({ type: SupplierMessageResponseDto })
  createMyMessage(
    @Body() dto: CreateSupplierMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createMyMessage(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Get()
  @ApiOperation({ summary: 'List suppliers (portal users are force-scoped)' })
  @ApiOkResponse({ type: [SupplierResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    const scoped = resolveSupplierScope(user);
    return this.service.list(user.organizationId, scoped);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Patch(':id')
  @ApiOperation({ summary: 'Staff — update supplier master data' })
  @ApiOkResponse({ type: SupplierResponseDto })
  updateStaff(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateStaff(id, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve supplier registration (creator ≠ approver)',
  })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject pending supplier (creator ≠ rejector)' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectSupplierDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend an approved supplier' })
  suspend(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.suspend(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Get(':id/messages')
  @ApiOperation({
    summary: 'Staff — list messages for one supplier',
  })
  @ApiOkResponse({ type: [SupplierMessageResponseDto] })
  staffMessages(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.listStaffMessages(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('procurement.manage')
  @Post(':id/messages')
  @ApiOperation({
    summary: 'Staff — reply to a supplier (procurement officer)',
  })
  @ApiCreatedResponse({ type: SupplierMessageResponseDto })
  staffCreateMessage(
    @Param('id') id: string,
    @Body() dto: CreateSupplierMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createStaffMessage(id, dto, user);
  }
}

@ApiTags('Procurement — Supplier submissions')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('procurement.manage')
@Controller('procurement/supplier-submissions')
export class SupplierSubmissionsController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  @ApiOperation({
    summary: 'Staff — list supplier quotes / invoices / DNs / payment requests',
  })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiOkResponse({ type: [SupplierSubmissionResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('supplierId') supplierId?: string,
  ) {
    const scoped = resolveSupplierScope(user, supplierId);
    return this.service.listSubmissions(user.organizationId, scoped);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Staff — approve submission (creator ≠ approver)' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveSubmission(id, user);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Staff — reject submission (creator ≠ rejector)' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectSupplierSubmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.rejectSubmission(id, dto, user);
  }

  @Post(':id/mark-paid')
  @ApiOperation({
    summary: 'Staff — mark approved invoice / payment request as paid',
  })
  markPaid(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.markSubmissionPaid(id, user);
  }
}

@ApiTags('Procurement — Purchase Orders')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('procurement.manage')
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
    return this.service.list(user.organizationId, scoped, {
      issuedToSupplier: Boolean(user.supplierId),
    });
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

@ApiTags('Procurement — Purchase requests')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('procurement.manage')
@Controller('procurement/purchase-requests')
export class PurchaseRequestsController {
  constructor(private readonly service: PurchaseRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create purchase request (DRAFT)' })
  create(
    @Body() dto: CreatePurchaseRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List purchase requests' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit purchase request for approval' })
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve purchase request (creator ≠ approver)' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject purchase request (creator ≠ rejector)' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectPurchaseRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, dto, user);
  }

  @Post(':id/quotes')
  @ApiOperation({ summary: 'Add a supplier quote for comparison' })
  addQuote(
    @Param('id') id: string,
    @Body() dto: CreatePurchaseRequestQuoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addQuote(id, dto, user);
  }

  @Post(':id/quotes/:quoteId/award')
  @ApiOperation({
    summary: 'Award a quote after comparing at least two (creator ≠ awarder)',
  })
  award(
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.awardQuote(id, quoteId, user);
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Raise a DRAFT purchase order from the awarded quote' })
  convert(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.convertToPo(id, user);
  }
}

@ApiTags('Procurement — Reports')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('procurement.manage')
@Controller('procurement/reports')
export class ProcurementReportsController {
  constructor(private readonly service: PurchaseRequestsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Live buying pack — suppliers, PRs, POs, GRNs, unpaid vendor submissions (no fake KPIs)',
  })
  @ApiOkResponse({ type: ProcurementReportResponseDto })
  reports(@CurrentUser() user: AuthUser) {
    return this.service.getReports(user);
  }
}

@ApiTags('Procurement — Receiving')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequireAnyPermissions('procurement.manage', 'inventory.manage')
@Controller('procurement/receiving')
export class ReceivingController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'POs awaiting goods receipt (storekeeper or procurement)',
  })
  list(@CurrentUser() user: AuthUser) {
    return this.service.listReceiving(user.organizationId);
  }

  @Get(':id/goods-receipts')
  @ApiOperation({ summary: 'List GRNs for a purchase order' })
  listGrns(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.listGoodsReceipts(id, user.organizationId);
  }

  @Post(':id/goods-receipts')
  @ApiOperation({ summary: 'Record goods receipt (GRN) and post stock IN' })
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
}
