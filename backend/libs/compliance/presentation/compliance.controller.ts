import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
  RequireAnyPermissions,
  RequirePermissions,
} from '@pssms/shared';
import { ComplianceService } from '../application/compliance.service';
import {
  CreateBreachDto,
  CreatePolicyDto,
  DataBreachCaseResponseDto,
  PolicyDocumentResponseDto,
  RejectPolicyDto,
  UpdateBreachDto,
  UpdatePolicyDto,
} from './dto/compliance.dto';

@ApiTags('Compliance')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  // ── Policies ──

  @Get('policies')
  @RequireAnyPermissions('compliance.manage', 'audit.read')
  @ApiOperation({ summary: 'List org policy documents' })
  @ApiOkResponse({ type: [PolicyDocumentResponseDto] })
  listPolicies(@CurrentUser() user: AuthUser) {
    return this.service.listPolicies(user.organizationId);
  }

  @Post('policies')
  @RequirePermissions('compliance.manage')
  @ApiOperation({ summary: 'Create draft policy' })
  @ApiCreatedResponse({ type: PolicyDocumentResponseDto })
  createPolicy(@Body() dto: CreatePolicyDto, @CurrentUser() user: AuthUser) {
    return this.service.createPolicy(dto, user);
  }

  @Get('policies/:id')
  @RequireAnyPermissions('compliance.manage', 'audit.read')
  @ApiOperation({ summary: 'Get policy by id' })
  @ApiOkResponse({ type: PolicyDocumentResponseDto })
  getPolicy(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getPolicy(id, user.organizationId);
  }

  @Patch('policies/:id')
  @RequirePermissions('compliance.manage')
  @ApiOperation({ summary: 'Update draft/rejected policy' })
  @ApiOkResponse({ type: PolicyDocumentResponseDto })
  updatePolicy(
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updatePolicy(id, dto, user);
  }

  @Post('policies/:id/submit')
  @RequirePermissions('compliance.manage')
  @ApiOperation({
    summary: 'Submit policy for approval (policy-change-approval)',
  })
  @ApiOkResponse({ type: PolicyDocumentResponseDto })
  submitPolicy(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.submitPolicy(id, user);
  }

  @Post('policies/:id/approve')
  @RequirePermissions('compliance.manage')
  @ApiOperation({
    summary:
      'Approve policy step (multi-step safe; publishes on final APPROVED)',
  })
  @ApiOkResponse({ type: PolicyDocumentResponseDto })
  approvePolicy(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approvePolicy(id, user);
  }

  @Post('policies/:id/reject')
  @RequirePermissions('compliance.manage')
  @ApiOperation({ summary: 'Reject policy (creator ≠ approver)' })
  @ApiOkResponse({ type: PolicyDocumentResponseDto })
  rejectPolicy(
    @Param('id') id: string,
    @Body() dto: RejectPolicyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.rejectPolicy(id, dto, user);
  }

  @Post('policies/:id/archive')
  @RequirePermissions('compliance.manage')
  @ApiOperation({ summary: 'Archive a published policy' })
  @ApiOkResponse({ type: PolicyDocumentResponseDto })
  archivePolicy(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.archivePolicy(id, user);
  }

  // ── Breaches ──

  @Get('breaches')
  @RequireAnyPermissions('dpo.manage', 'compliance.manage', 'audit.read')
  @ApiOperation({
    summary: 'List DPO data breach register (not ops SECURITY_BREACH)',
  })
  @ApiOkResponse({ type: [DataBreachCaseResponseDto] })
  listBreaches(@CurrentUser() user: AuthUser) {
    return this.service.listBreaches(user);
  }

  @Post('breaches')
  @RequirePermissions('dpo.manage')
  @ApiOperation({
    summary: 'Report a data breach case (DPO / CISO — dpo.manage)',
  })
  @ApiCreatedResponse({ type: DataBreachCaseResponseDto })
  createBreach(@Body() dto: CreateBreachDto, @CurrentUser() user: AuthUser) {
    return this.service.createBreach(dto, user);
  }

  @Get('breaches/:id')
  @RequireAnyPermissions('dpo.manage', 'compliance.manage', 'audit.read')
  @ApiOperation({ summary: 'Get breach case by id' })
  @ApiOkResponse({ type: DataBreachCaseResponseDto })
  getBreach(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getBreach(id, user);
  }

  @Patch('breaches/:id')
  @RequirePermissions('dpo.manage')
  @ApiOperation({
    summary:
      'Update breach (DPO/CISO; status REPORTED→INVESTIGATING→CONTAINED→CLOSED)',
  })
  @ApiOkResponse({ type: DataBreachCaseResponseDto })
  updateBreach(
    @Param('id') id: string,
    @Body() dto: UpdateBreachDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateBreach(id, dto, user);
  }
}
