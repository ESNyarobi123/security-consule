import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
import { BranchesService } from '../application/branches.service';
import {
  BranchResponseDto,
  CreateBranchDto,
  UpdateBranchDto,
} from './dto/enterprise.dto';

@ApiTags('Enterprise')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('enterprise/branches')
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Post()
  @RequirePermissions('enterprise.manage')
  @ApiOperation({ summary: 'Create branch (Portal 35.1 master data)' })
  @ApiCreatedResponse({ type: BranchResponseDto })
  create(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @RequireAnyPermissions(
    'enterprise.manage',
    'operations.manage',
    'users.manage',
    'customers.manage',
  )
  @ApiOperation({ summary: 'List branches' })
  @ApiOkResponse({ type: [BranchResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }

  @Patch(':id')
  @RequirePermissions('enterprise.manage')
  @ApiOperation({ summary: 'Update branch name/region or deactivate' })
  @ApiOkResponse({ type: BranchResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }
}
