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
  RequireAnyPermissions,
  RequirePermissions,
} from '@pssms/shared';
import { ApprovalsService } from '../application/approvals.service';
import {
  ApprovalActionDto,
  ApprovalInstanceResponseDto,
  StartApprovalDto,
  WorkflowCatalogDto,
} from './dto/approval.dto';

@ApiTags('Approvals')
@ApiBearerAuth()
@Controller('approvals')
@UseGuards(PermissionsGuard)
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get('workflows')
  @RequireAnyPermissions('approvals.act', 'users.manage')
  @ApiOperation({
    summary:
      'List approval workflow definitions and current steps (Portal 35.1 catalog)',
  })
  @ApiOkResponse({ type: [WorkflowCatalogDto] })
  listWorkflows(@CurrentUser() user: AuthUser) {
    return this.service.listWorkflows(user.organizationId);
  }

  @Post('instances')
  @RequirePermissions('approvals.act')
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
  @RequirePermissions('approvals.act')
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
  @RequirePermissions('approvals.act')
  @ApiOperation({ summary: 'List approval instances' })
  @ApiOkResponse({ type: [ApprovalInstanceResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }
}
