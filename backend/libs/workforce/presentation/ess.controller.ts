import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
} from '@pssms/shared';
import { EssService } from '../application/ess.service';
import {
  LeaveRequestResponseDto,
  LeaveTypeResponseDto,
} from './dto/leave.dto';
import {
  EssApplyLeaveDto,
  EssApplyLoanDto,
  EssApplyPettyCashDto,
  EssEquipmentResponseDto,
  EssPayslipResponseDto,
  EssPettyCashVoucherResponseDto,
  EssProfileResponseDto,
  EssRequestItemDto,
} from './dto/ess.dto';

/**
 * Employee Self-Service (§35.5) — admin-web `/ess`.
 * All routes resolve the caller's Employee via userId (never org-wide HR lists).
 */
@ApiTags('ESS — Self-Service')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('ess.access')
@Controller('ess')
export class EssController {
  constructor(private readonly service: EssService) {}

  @Get('me')
  @ApiOperation({ summary: 'My employee profile (linked by userId)' })
  @ApiOkResponse({ type: EssProfileResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return this.service.getMe(user);
  }

  @Get('leave/types')
  @ApiOperation({ summary: 'Leave types available to me' })
  @ApiOkResponse({ type: [LeaveTypeResponseDto] })
  leaveTypes(@CurrentUser() user: AuthUser) {
    return this.service.listLeaveTypes(user);
  }

  @Get('leave/requests')
  @ApiOperation({ summary: 'My leave requests only' })
  @ApiOkResponse({ type: [LeaveRequestResponseDto] })
  myLeave(@CurrentUser() user: AuthUser) {
    return this.service.listMyLeave(user);
  }

  @Post('leave/requests')
  @ApiOperation({ summary: 'Apply for leave (self only; starts approval)' })
  @ApiCreatedResponse({ type: LeaveRequestResponseDto })
  applyLeave(@Body() dto: EssApplyLeaveDto, @CurrentUser() user: AuthUser) {
    return this.service.applyLeave(dto, user);
  }

  @Get('payslips')
  @ApiOperation({ summary: 'My payslip snapshots only (immutable)' })
  @ApiOkResponse({ type: [EssPayslipResponseDto] })
  payslips(@CurrentUser() user: AuthUser) {
    return this.service.listMyPayslips(user);
  }

  @Get('payslips/:id')
  @ApiOperation({ summary: 'My payslip by id' })
  @ApiOkResponse({ type: EssPayslipResponseDto })
  payslip(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getMyPayslip(id, user);
  }

  @Get('loans')
  @ApiOperation({ summary: 'My loans only' })
  listLoans(@CurrentUser() user: AuthUser) {
    return this.service.listMyLoans(user);
  }

  @Post('loans')
  @ApiOperation({ summary: 'Apply for loan (self only; starts approval)' })
  applyLoan(@Body() dto: EssApplyLoanDto, @CurrentUser() user: AuthUser) {
    return this.service.applyLoan(dto, user);
  }

  @Get('loans/:id/statement')
  @ApiOperation({ summary: 'My loan statement — balance and repayment schedule' })
  loanStatement(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getMyLoanStatement(id, user);
  }

  @Post('loans/:id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge receipt of item loan' })
  acknowledgeLoan(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.acknowledgeMyLoan(id, user);
  }

  @Get('equipment')
  @ApiOperation({ summary: 'Equipment currently assigned to me' })
  @ApiOkResponse({ type: [EssEquipmentResponseDto] })
  equipment(@CurrentUser() user: AuthUser) {
    return this.service.listMyEquipment(user);
  }

  @Post('equipment/:assignmentId/return')
  @ApiOperation({
    summary:
      'Request return of my assigned equipment (storekeeper confirms separately)',
  })
  @ApiOkResponse({ type: EssEquipmentResponseDto })
  returnEquipment(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.returnMyEquipment(assignmentId, user);
  }

  @Get('petty-cash')
  @ApiOperation({ summary: 'My petty cash voucher requests only' })
  @ApiOkResponse({ type: [EssPettyCashVoucherResponseDto] })
  listPettyCash(@CurrentUser() user: AuthUser) {
    return this.service.listMyPettyCash(user);
  }

  @Post('petty-cash')
  @ApiOperation({
    summary:
      'Request petty cash (self; fund auto-selected). Cash is issued only after finance approval.',
  })
  @ApiCreatedResponse({ type: EssPettyCashVoucherResponseDto })
  applyPettyCash(
    @Body() dto: EssApplyPettyCashDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.applyPettyCash(dto, user);
  }

  @Get('requests')
  @ApiOperation({
    summary:
      'My requests inbox (leave + loans + movements + petty cash — no approve)',
  })
  @ApiOkResponse({ type: [EssRequestItemDto] })
  requests(@CurrentUser() user: AuthUser) {
    return this.service.listMyRequests(user);
  }
}
