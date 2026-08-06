import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
} from '@pssms/shared';
import { UsersService } from '../application/users.service';
import {
  CreateUserDto,
  IamChangeRequestResponseDto,
  LoginHistoryResponseDto,
  PasswordPolicyDto,
  RejectIamChangeDto,
  ResetPasswordDto,
  SetUserAccessDto,
  SetUserRolesDto,
  SuspendUserDto,
  UserAccessResponseDto,
  UserResponseDto,
} from './dto/user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('users.manage')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create user',
    description: 'Creates a user in the actor organization and assigns roles.',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List users in current organization' })
  @ApiOkResponse({ type: [UserResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.usersService.list(user.organizationId);
  }

  @Get('password-policy')
  @ApiOperation({
    summary: 'Get organization password policy (Module 5-K)',
    description:
      'Resolved policy (org overlay merged with enterprise defaults).',
  })
  @ApiOkResponse({ type: PasswordPolicyDto })
  getPasswordPolicy(@CurrentUser() user: AuthUser) {
    return this.usersService.getPasswordPolicy(user);
  }

  @Put('password-policy')
  @ApiOperation({
    summary: 'Update organization password policy (Module 5-K)',
    description: 'SUPER_ADMIN / GENERAL_MANAGER only. Audited.',
  })
  @ApiOkResponse({ type: PasswordPolicyDto })
  setPasswordPolicy(
    @Body() dto: PasswordPolicyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.setPasswordPolicy(dto, user);
  }

  @Get('login-history')
  @ApiOperation({
    summary: 'List login history (Module 5 · org-scoped)',
    description:
      'Recent success/failure attempts for users in the actor organization. Optional userId filter.',
  })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'success', required: false, type: Boolean })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiOkResponse({ type: [LoginHistoryResponseDto] })
  listLoginHistory(
    @CurrentUser() user: AuthUser,
    @Query('userId') userId?: string,
    @Query('success') success?: string,
    @Query('take') take?: string,
  ) {
    const successFilter =
      success === undefined
        ? undefined
        : success === 'true' || success === '1'
          ? true
          : success === 'false' || success === '0'
            ? false
            : undefined;
    const takeNum = take ? Number.parseInt(take, 10) : undefined;
    return this.usersService.listLoginHistory(user, {
      userId,
      success: successFilter,
      take: Number.isFinite(takeNum) ? takeNum : undefined,
    });
  }

  @Get('role-change-requests')
  @ApiOperation({
    summary: 'List IAM role-change requests (Module 5-E)',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({ type: [IamChangeRequestResponseDto] })
  listRoleChangeRequests(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
  ) {
    return this.usersService.listRoleChangeRequests(user, status);
  }

  @Post('role-change-requests/:requestId/approve')
  @ApiOperation({
    summary: 'Approve IAM role-change request (GM step · creator ≠ approver)',
  })
  @ApiOkResponse({ type: IamChangeRequestResponseDto })
  approveRoleChange(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.approveRoleChange(requestId, user);
  }

  @Post('role-change-requests/:requestId/reject')
  @ApiOperation({ summary: 'Reject IAM role-change request' })
  @ApiOkResponse({ type: IamChangeRequestResponseDto })
  rejectRoleChange(
    @Param('requestId') requestId: string,
    @Body() dto: RejectIamChangeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.rejectRoleChange(requestId, dto.reason, user);
  }

  @Get(':id/access')
  @ApiOperation({
    summary: 'Get site/branch ACL for a staff user (Module 5-D)',
    description:
      'Returns assigned branch/site IDs plus org catalog for the picker. External portal accounts are rejected.',
  })
  @ApiOkResponse({ type: UserAccessResponseDto })
  getAccess(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.getAccess(id, user);
  }

  @Put(':id/access')
  @ApiOperation({
    summary: 'Replace site/branch ACL for a staff user (Module 5-D)',
    description:
      'Replaces UserBranchAccess + UserSiteAccess. JWT site scope refreshes on next login/refresh (A7). Audited.',
  })
  @ApiOkResponse({ type: UserAccessResponseDto })
  setAccess(
    @Param('id') id: string,
    @Body() dto: SetUserAccessDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.setAccess(id, dto.branchIds, dto.siteIds, user);
  }

  @Post(':id/reset-password')
  @ApiOperation({
    summary: 'Reset user password (Module 5-I)',
    description:
      'Sets a temporary password and mustChangePassword=true; also clears MFA (M5-J). Cannot reset own password. A6 privileged ceiling applies.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.resetPassword(id, dto.password, user);
  }

  @Post(':id/mfa/reset')
  @ApiOperation({
    summary: 'Admin reset of another user’s MFA (Module 5-J)',
    description:
      'Clears TOTP enrollment without requiring the user’s authenticator code. Cannot reset own MFA. A6 privileged ceiling applies.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  resetMfa(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.resetMfa(id, user);
  }

  @Patch(':id/suspend')
  @ApiOperation({
    summary: 'Suspend a user (break-glass)',
    description:
      'Immediate suspend — SUPER_ADMIN / GENERAL_MANAGER only. Others must POST …/suspend/submit.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  suspend(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.suspend(id, dto.reason, user);
  }

  @Post(':id/suspend/submit')
  @ApiOperation({
    summary: 'Submit suspend for GM approval (Module 5-F)',
    description:
      'Starts iam-role-change-approval for changeType=SUSPEND. Creator cannot approve.',
  })
  @ApiCreatedResponse({ type: IamChangeRequestResponseDto })
  submitSuspend(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.submitSuspend(id, dto.reason, user);
  }

  @Patch(':id/reactivate')
  @ApiOperation({
    summary: 'Reactivate a suspended user (break-glass)',
    description:
      'Immediate reactivate — SUPER_ADMIN / GENERAL_MANAGER only. Others must POST …/reactivate/submit.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  reactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.reactivate(id, user);
  }

  @Post(':id/reactivate/submit')
  @ApiOperation({
    summary: 'Submit reactivate for GM approval (Module 5-G)',
    description:
      'Starts iam-role-change-approval for changeType=REACTIVATE. Creator cannot approve.',
  })
  @ApiCreatedResponse({ type: IamChangeRequestResponseDto })
  submitReactivate(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.submitReactivate(id, dto.reason, user);
  }

  @Patch(':id/roles')
  @ApiOperation({
    summary: 'Replace a user\u2019s role assignments (break-glass)',
    description:
      'Immediate apply — SUPER_ADMIN / GENERAL_MANAGER only. Others must POST …/roles/submit.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  setRoles(
    @Param('id') id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.setRoles(id, dto.roleCodes, user);
  }

  @Post(':id/roles/submit')
  @ApiOperation({
    summary: 'Submit role change for GM approval (Module 5-E)',
    description:
      'Starts iam-role-change-approval. Creator cannot approve. Audited.',
  })
  @ApiCreatedResponse({ type: IamChangeRequestResponseDto })
  submitRoleChange(
    @Param('id') id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.submitRoleChange(id, dto.roleCodes, user);
  }
}
