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
  EssApprovalItemDto,
  EssAttendancePackDto,
  EssEquipmentResponseDto,
  EssLeaveBalanceDto,
  EssLoanBalanceDto,
  EssNoticeDto,
  EssPayslipResponseDto,
  EssPettyCashVoucherResponseDto,
  EssProfileResponseDto,
  EssRequestItemDto,
  EssTrainingRowDto,
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

  @Get('leave/balance')
  @ApiOperation({
    summary: 'My leave balance this calendar year (quota − approved − pending)',
  })
  @ApiOkResponse({ type: [EssLeaveBalanceDto] })
  leaveBalance(@CurrentUser() user: AuthUser) {
    return this.service.listLeaveBalances(user);
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

  @Get('loans/balance')
  @ApiOperation({ summary: 'My outstanding loan balance' })
  @ApiOkResponse({ type: EssLoanBalanceDto })
  loanBalance(@CurrentUser() user: AuthUser) {
    return this.service.getLoanBalance(user);
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

  @Post('equipment/:assignmentId/confirm')
  @ApiOperation({
    summary: 'Confirm I am holding this assigned equipment (duty kit check)',
  })
  @ApiOkResponse({ type: EssEquipmentResponseDto })
  confirmEquipment(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.confirmMyEquipment(assignmentId, user);
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

  @Get('attendance')
  @ApiOperation({
    summary:
      'My attendance — guard clock if linked; office punch is not on this portal',
  })
  @ApiOkResponse({ type: EssAttendancePackDto })
  attendance(@CurrentUser() user: AuthUser) {
    return this.service.listMyAttendance(user);
  }

  @Get('training')
  @ApiOperation({ summary: 'My training records (read-only)' })
  @ApiOkResponse({ type: [EssTrainingRowDto] })
  training(@CurrentUser() user: AuthUser) {
    return this.service.listMyTraining(user);
  }

  @Get('notices')
  @ApiOperation({
    summary:
      'Messages queued to my email/phone (company bulletin board deferred)',
  })
  @ApiOkResponse({ type: [EssNoticeDto] })
  notices(@CurrentUser() user: AuthUser) {
    return this.service.listMyNotices(user);
  }

  @Get('approvals')
  @ApiOperation({
    summary:
      'My submitted approval instances; pending-for-me if approvals.act (act on /approvals)',
  })
  @ApiOkResponse({ type: [EssApprovalItemDto] })
  approvals(@CurrentUser() user: AuthUser) {
    return this.service.listMyApprovals(user);
  }
}
