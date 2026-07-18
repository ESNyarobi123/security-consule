import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser, resolveCustomerScope } from '@pssms/shared';
import { InvoicesService } from '../application/invoices.service';
import { FinanceOpsService } from '../application/finance-ops.service';
import {
  CreateInvoiceDto,
  CreatePaymentVoucherDto,
  CreatePettyCashFundDto,
  CreatePettyCashVoucherDto,
  InvoiceResponseDto,
  PayVoucherDto,
  PaymentVoucherResponseDto,
  PettyCashFundResponseDto,
  PettyCashVoucherResponseDto,
  RecordInvoicePaymentDto,
} from './dto/finance.dto';

@ApiTags('Finance — Invoices')
@ApiBearerAuth()
@Controller('finance/invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create customer invoice' })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiOkResponse({ type: [InvoiceResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
  ) {
    const scoped = resolveCustomerScope(user, customerId);
    return this.service.list(user.organizationId, scoped);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Mark invoice as sent to customer' })
  send(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.send(id, user);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record invoice payment (provider-agnostic reference)' })
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordInvoicePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordPayment(id, dto, user);
  }
}

@ApiTags('Finance — Petty Cash')
@ApiBearerAuth()
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
  @ApiOperation({ summary: 'Approve petty cash voucher' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approvePettyCashVoucher(id, user);
  }
}

@ApiTags('Finance — Payment Vouchers')
@ApiBearerAuth()
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
