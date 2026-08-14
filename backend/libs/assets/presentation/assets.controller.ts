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
import { AssetsService } from '../application/assets.service';
import {
  AssetAssigneeOptionsDto,
  AssetAssignmentResponseDto,
  AssetLifecycleEventResponseDto,
  AssetResponseDto,
  AssignAssetDto,
  CategoryOptionDto,
  ConfirmReturnDto,
  CreateAssetDto,
  DamageAssetDto,
  DisposeAssetDto,
  MaintenanceDto,
  ReplacementDto,
  TransferAssetDto,
  WalkInReturnDto,
} from './dto/assets.dto';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('assets.manage')
@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Register asset' })
  @ApiCreatedResponse({ type: AssetResponseDto })
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List assets' })
  @ApiOkResponse({ type: [AssetResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }

  /** Static path before `:id` routes — design asset category catalog. */
  @Get('category-options')
  @ApiOperation({ summary: 'List supported asset categories' })
  @ApiOkResponse({ type: [CategoryOptionDto] })
  listCategoryOptions() {
    return this.service.listCategoryOptions();
  }

  /** Static path before `:id` routes — assignee picker for storekeepers. */
  @Get('assignee-options')
  @ApiOperation({
    summary:
      'List employees + guards for assign UI (assets.manage — no hr.manage required)',
  })
  @ApiOkResponse({ type: AssetAssigneeOptionsDto })
  listAssigneeOptions(@CurrentUser() user: AuthUser) {
    return this.service.listAssigneeOptions(user.organizationId);
  }

  /** Static path before `:id` routes — pending ESS return queue. */
  @Get('assignments/pending-returns')
  @ApiOperation({ summary: 'List assignments awaiting storekeeper return confirm' })
  @ApiOkResponse({ type: [AssetAssignmentResponseDto] })
  listPendingReturns(@CurrentUser() user: AuthUser) {
    return this.service.listPendingReturns(user.organizationId);
  }

  @Post('assignments/:assignmentId/confirm-return')
  @ApiOperation({
    summary: 'Storekeeper confirm ESS return request (creator ≠ confirmer)',
  })
  @ApiOkResponse({ type: AssetAssignmentResponseDto })
  confirmReturn(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ConfirmReturnDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.confirmReturn(assignmentId, dto, user);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'List asset lifecycle history' })
  @ApiOkResponse({ type: [AssetLifecycleEventResponseDto] })
  listHistory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.listHistory(id, user);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign asset to employee or guard' })
  @ApiCreatedResponse({ type: AssetAssignmentResponseDto })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignAssetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assign(id, dto, user);
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: 'Transfer assigned asset to a new assignee' })
  @ApiCreatedResponse({ type: AssetAssignmentResponseDto })
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferAssetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.transfer(id, dto, user);
  }

  @Post(':id/dispose')
  @ApiOperation({ summary: 'Dispose available or maintenance asset' })
  @ApiOkResponse({ type: AssetResponseDto })
  dispose(
    @Param('id') id: string,
    @Body() dto: DisposeAssetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.dispose(id, dto, user);
  }

  @Post(':id/maintenance/start')
  @ApiOperation({ summary: 'Start asset maintenance' })
  @ApiOkResponse({ type: AssetResponseDto })
  startMaintenance(
    @Param('id') id: string,
    @Body() dto: MaintenanceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.startMaintenance(id, dto, user);
  }

  @Post(':id/maintenance/complete')
  @ApiOperation({ summary: 'Complete asset maintenance' })
  @ApiOkResponse({ type: AssetResponseDto })
  completeMaintenance(
    @Param('id') id: string,
    @Body() dto: MaintenanceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.completeMaintenance(id, dto, user);
  }

  @Post(':id/damage')
  @ApiOperation({ summary: 'Record asset damage or loss observation' })
  @ApiCreatedResponse({ type: AssetLifecycleEventResponseDto })
  recordDamage(
    @Param('id') id: string,
    @Body() dto: DamageAssetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordDamage(id, dto, user);
  }

  @Post(':id/replacement')
  @ApiOperation({ summary: 'Link a replacement asset' })
  @ApiCreatedResponse({ type: AssetLifecycleEventResponseDto })
  recordReplacement(
    @Param('id') id: string,
    @Body() dto: ReplacementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordReplacement(id, dto, user);
  }

  @Post(':id/return')
  @ApiOperation({
    summary: 'Walk-in return assigned asset (storekeeper override)',
  })
  @ApiOkResponse({ type: AssetAssignmentResponseDto })
  returnAsset(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto?: WalkInReturnDto,
  ) {
    return this.service.returnAsset(id, user, dto ?? {});
  }
}
