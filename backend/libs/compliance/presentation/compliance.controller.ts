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
  CatalogOptionDto,
  ConsentRecordResponseDto,
  CreateBreachDto,
  CreateConsentDto,
  CreatePolicyDto,
  DataBreachCaseResponseDto,
  PolicyDocumentResponseDto,
  RejectPolicyDto,
  UpdateBreachDto,
  UpdatePolicyDto,
  WithdrawConsentDto,
} from './dto/compliance.dto';

@ApiTags('Compliance')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  // ── Policies ──

  @Get('policy-category-options')
  @RequireAnyPermissions('compliance.manage', 'audit.read')
  @ApiOperation({ summary: 'Policy category catalog (design §32 domains)' })
  @ApiOkResponse({ type: [CatalogOptionDto] })
  policyCategoryOptions() {
    return this.service.policyCategoryOptions();
  }

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

  // ── Consents (Module 32-A) ──

  @Get('consent-options')
  @RequireAnyPermissions('dpo.manage', 'compliance.manage', 'audit.read')
  @ApiOperation({
    summary: 'Consent purpose / subject / lawful-basis / channel catalogs',
  })
  consentOptions() {
    return this.service.consentCatalogOptions();
  }

  @Get('consents')
  @RequireAnyPermissions('dpo.manage', 'compliance.manage', 'audit.read')
  @ApiOperation({
    summary: 'List DPO consent / lawful-basis records (PII-sensitive)',
  })
  @ApiOkResponse({ type: [ConsentRecordResponseDto] })
  listConsents(@CurrentUser() user: AuthUser) {
    return this.service.listConsents(user);
  }

  @Post('consents')
  @RequirePermissions('dpo.manage')
  @ApiOperation({ summary: 'Record consent or lawful-basis entry (DPO/CISO)' })
  @ApiCreatedResponse({ type: ConsentRecordResponseDto })
  createConsent(@Body() dto: CreateConsentDto, @CurrentUser() user: AuthUser) {
    return this.service.createConsent(dto, user);
  }

  @Post('consents/:id/withdraw')
  @RequirePermissions('dpo.manage')
  @ApiOperation({
    summary: 'Withdraw an ACTIVE consent (reason required; audited)',
  })
  @ApiOkResponse({ type: ConsentRecordResponseDto })
  withdrawConsent(
    @Param('id') id: string,
    @Body() dto: WithdrawConsentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.withdrawConsent(id, dto, user);
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
