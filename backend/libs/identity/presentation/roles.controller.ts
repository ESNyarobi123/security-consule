import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
  RequirePermissions,
} from '@pssms/shared';
import { RolesService } from '../application/roles.service';
import {
  CreateRoleDto,
  PermissionResponseDto,
  PortalCatalogResponseDto,
  RoleResponseDto,
  SetRolePermissionsDto,
} from './dto/role.dto';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('users.manage')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List roles in current organization' })
  @ApiOkResponse({ type: [RoleResponseDto] })
  listRoles(@CurrentUser() user: AuthUser) {
    return this.rolesService.listRoles(user.organizationId);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all assignable permissions' })
  @ApiOkResponse({ type: [PermissionResponseDto] })
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get('portal-catalog')
  @ApiOperation({
    summary:
      'Design §35 portals + §36 account types with live role/user/permission coverage',
  })
  @ApiOkResponse({ type: PortalCatalogResponseDto })
  portalCatalog(@CurrentUser() user: AuthUser) {
    return this.rolesService.portalCatalog(user.organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom role' })
  @ApiCreatedResponse({ type: RoleResponseDto })
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthUser) {
    return this.rolesService.createRole(dto, user);
  }

  @Put(':id/permissions')
  @ApiOperation({
    summary: 'Replace a role\u2019s permission set',
    description:
      'Sets the exact list of permissions for the role. Audited. System roles are locked. §4 A6: non-GM/SuperAdmin cannot grant users.manage.',
  })
  @ApiOkResponse({ type: RoleResponseDto })
  setRolePermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rolesService.setRolePermissions(id, dto.permissionCodes, user);
  }
}
