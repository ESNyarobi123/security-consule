import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
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
import { PettyCashVoucherStatus } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
  resolveCustomerScope,
} from '@pssms/shared';
import { InvoicesService } from '../application/invoices.service';
import { FinanceOpsService } from '../application/finance-ops.service';
import {
  CreateInvoiceDto,
  CreatePaymentVoucherDto,
  CreatePettyCashFundDto,
  CreatePettyCashVoucherDto,
  DisputeInvoiceDto,
  InvoiceAlertsPackDto,
  InvoiceResponseDto,
  InvoiceScanOverdueResultDto,
  PayVoucherDto,
  PaymentVoucherResponseDto,
  PettyCashFundResponseDto,
  PettyCashVoucherResponseDto,
  RecordInvoicePaymentDto,
  RejectPettyCashVoucherDto,
  ReimbursePettyCashVoucherDto,
  VoidInvoiceDto,
} from './dto/finance.dto';

function assertStaff(user: AuthUser) {
  if (user.customerId) {
    throw new ForbiddenException('Staff only');
  }
}

@ApiTags('Finance — Invoices')
@ApiBearerAuth()
@Controller('finance/invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.manage')
  @ApiOperation({ summary: 'Create customer invoice' })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    assertStaff(user);
    return this.service.create(dto, user);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.manage')
  @ApiOperation({
    summary: 'List invoices',
    description:
      'Staff: finance.manage (org-wide). Customer portal: own customer via JWT scope (portal role has finance.manage).',
  })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'contractId', required: false })
  @ApiOkResponse({ type: [InvoiceResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
    @Query('contractId') contractId?: string,
  ) {
    const scoped = resolveCustomerScope(user, customerId);
    return this.service.list(user.organizationId, scoped, contractId);
  }

  @Get('alerts')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.manage')
  @ApiOperation({
    summary:
      'Billing alerts pack — overdue, unpaid, completed payments, payroll-due invoices, contract expiry, suspension risk',
  })
  @ApiOkResponse({ type: InvoiceAlertsPackDto })
  alerts(@CurrentUser() user: AuthUser) {
    assertStaff(user);
    return this.service.listAlerts(user.organizationId);
  }

  @Post('scan-overdue')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.manage')
  @ApiOperation({
    summary:
      'Mark past-due SENT/PARTIALLY_PAID as OVERDUE and queue overdue / unpaid / suspension EMAIL alerts',
    description: 'Also callable by background-worker via internal route.',
  })
  @ApiOkResponse({ type: InvoiceScanOverdueResultDto })
  scanOverdue(@CurrentUser() user: AuthUser) {
    assertStaff(user);
    return this.service.scanOverdue(user.organizationId, user);
  }

  @Post(':id/send')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.manage')
  @ApiOperation({ summary: 'Mark invoice as sent to customer' })
  send(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertStaff(user);
    return this.service.send(id, user);
  }

  @Post(':id/void')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.manage')
  @ApiOperation({
    summary: 'Cancel unpaid DRAFT / issued / overdue / disputed invoice (stored VOIDED)',
  })
  @ApiOkResponse({ type: InvoiceResponseDto })
  voidInvoice(
    @Param('id') id: string,
    @Body() dto: VoidInvoiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertStaff(user);
    return this.service.void(id, dto, user);
  }

  @Post(':id/dispute')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.manage')
  @ApiOperation({ summary: 'Mark issued / partial / overdue invoice as DISPUTED' })
  @ApiOkResponse({ type: InvoiceResponseDto })
  dispute(
    @Param('id') id: string,
    @Body() dto: DisputeInvoiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertStaff(user);
    return this.service.dispute(id, dto, user);
  }

  @Post(':id/close')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.manage')
  @ApiOperation({ summary: 'Close a fully paid invoice' })
  @ApiOkResponse({ type: InvoiceResponseDto })
  close(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertStaff(user);
    return this.service.close(id, user);
  }

  @Post(':id/payments')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('finance.manage')
  @ApiOperation({ summary: 'Record invoice payment (provider-agnostic reference)' })
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordInvoicePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertStaff(user);
    return this.service.recordPayment(id, dto, user);
  }
}

@ApiTags('Finance — Petty Cash')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('finance.manage')
@Controller('finance/petty-cash')
export class PettyCashController {
  constructor(private readonly service: FinanceOpsService) {}

  @Post('funds')
  @ApiOperation({ summary: 'Create petty cash imprest fund' })
  @ApiCreatedResponse({ type: PettyCashFundResponseDto })
  createFund(
    @Body() dto: CreatePettyCashFundDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createPettyCashFund(dto, user);
  }

  @Get('funds')
  @ApiOperation({ summary: 'List petty cash funds' })
  @ApiOkResponse({ type: [PettyCashFundResponseDto] })
  listFunds(@CurrentUser() user: AuthUser) {
    return this.service.listPettyCashFunds(user.organizationId);
  }

  @Get('vouchers')
  @ApiOperation({ summary: 'List petty cash vouchers (org-wide)' })
  @ApiQuery({ name: 'status', required: false, enum: PettyCashVoucherStatus })
  @ApiOkResponse({ type: [PettyCashVoucherResponseDto] })
  listVouchers(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: PettyCashVoucherStatus,
  ) {
    return this.service.listPettyCashVouchers(user.organizationId, status);
  }

  @Post('vouchers')
  @ApiOperation({ summary: 'Create petty cash voucher (starts approval)' })
  @ApiCreatedResponse({ type: PettyCashVoucherResponseDto })
  createVoucher(
    @Body() dto: CreatePettyCashVoucherDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createPettyCashVoucher(dto, user);
  }

  @Post('vouchers/:id/approve')
  @ApiOperation({ summary: 'Approve petty cash voucher (creator ≠ approver)' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approvePettyCashVoucher(id, user);
  }

  @Post('vouchers/:id/reject')
  @ApiOperation({ summary: 'Reject petty cash voucher (creator ≠ approver)' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectPettyCashVoucherDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.rejectPettyCashVoucher(id, dto, user);
  }

  @Post('vouchers/:id/issue')
  @ApiOperation({
    summary:
      'Issue cash after approval (debits imprest; creator ≠ issuer). No issue without approval.',
  })
  @ApiOkResponse({ type: PettyCashVoucherResponseDto })
  issue(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.issuePettyCashVoucher(id, user);
  }

  @Post('vouchers/:id/reimburse')
  @ApiOperation({
    summary:
      'Retire issued voucher (ISSUED → REIMBURSED) with receipt URL and/or notes; creator ≠ retiree',
  })
  @ApiOkResponse({ type: PettyCashVoucherResponseDto })
  reimburse(
    @Param('id') id: string,
    @Body() dto: ReimbursePettyCashVoucherDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reimbursePettyCashVoucher(id, dto, user);
  }
}

@ApiTags('Finance — Payment Vouchers')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('finance.manage')
@Controller('finance/payment-vouchers')
export class PaymentVouchersController {
  constructor(private readonly service: FinanceOpsService) {}

  @Post()
  @ApiOperation({ summary: 'Create payment voucher (AP)' })
  @ApiCreatedResponse({ type: PaymentVoucherResponseDto })
  create(@Body() dto: CreatePaymentVoucherDto, @CurrentUser() user: AuthUser) {
    return this.service.createPaymentVoucher(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List payment vouchers' })
  @ApiOkResponse({ type: [PaymentVoucherResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.listPaymentVouchers(user.organizationId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve payment voucher' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approvePaymentVoucher(id, user);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Mark payment voucher as paid' })
  pay(
    @Param('id') id: string,
    @Body() dto: PayVoucherDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.payPaymentVoucher(id, dto.paymentReference, user);
  }
}
