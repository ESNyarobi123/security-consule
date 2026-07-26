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
  AssetResponseDto,
  AssignAssetDto,
  ConfirmReturnDto,
  CreateAssetDto,
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
