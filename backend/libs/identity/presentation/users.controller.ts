import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { UsersService } from '../application/users.service';
import {
  CreateUserDto,
  SetUserRolesDto,
  SuspendUserDto,
  UserResponseDto,
} from './dto/user.dto';

@ApiTags('Users')
@ApiBearerAuth()
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

  @Patch(':id/suspend')
  @ApiOperation({
    summary: 'Suspend a user',
    description: 'Deactivates the account and blocks login. Audited.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  suspend(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.suspend(id, dto.reason, user);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended user' })
  @ApiOkResponse({ type: UserResponseDto })
  reactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.reactivate(id, user);
  }

  @Patch(':id/roles')
  @ApiOperation({
    summary: 'Replace a user\u2019s role assignments',
    description: 'Sets the exact set of roles for the user. Audited.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  setRoles(
    @Param('id') id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.setRoles(id, dto.roleCodes, user);
  }
}
