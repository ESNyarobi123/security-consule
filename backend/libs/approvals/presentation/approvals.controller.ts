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
import { ApprovalsService } from '../application/approvals.service';
import {
  ApprovalActionDto,
  ApprovalInstanceResponseDto,
  StartApprovalDto,
} from './dto/approval.dto';

@ApiTags('Approvals')
@ApiBearerAuth()
@Controller('approvals')
@UseGuards(PermissionsGuard)
@RequirePermissions('approvals.act')
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Post('instances')
  @ApiOperation({
    summary: 'Start an approval workflow instance',
    description:
      'Creates a pending approval for a resource (e.g. Contract). Creator cannot later approve the same instance. Requires approvals.act.',
  })
  @ApiCreatedResponse({ type: ApprovalInstanceResponseDto })
  start(@Body() dto: StartApprovalDto, @CurrentUser() user: AuthUser) {
    return this.service.start(dto, user);
  }

  @Post('instances/:id/actions')
  @ApiOperation({
    summary: 'Approve or reject (creator ≠ approver enforced)',
    description:
      'Records an approval action. Returns 403 CREATOR_CANNOT_APPROVE if actor created the request. For Contract resources, terminal APPROVE/REJECT also syncs contract status (avoids PENDING_APPROVAL desync). Prefer domain routes (/contracts/:id/approve) when available.',
  })
  @ApiOkResponse({ type: ApprovalInstanceResponseDto })
  act(
    @Param('id') id: string,
    @Body() dto: ApprovalActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.act(id, dto, user);
  }

  @Get('instances')
  @ApiOperation({ summary: 'List approval instances' })
  @ApiOkResponse({ type: [ApprovalInstanceResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }
}
