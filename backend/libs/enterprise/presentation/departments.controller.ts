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
import { DepartmentsService } from '../application/departments.service';
import {
  CreateDepartmentDto,
  DepartmentResponseDto,
  UpdateDepartmentDto,
} from './dto/enterprise.dto';

@ApiTags('Enterprise')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('enterprise/departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Post()
  @RequirePermissions('enterprise.manage')
  @ApiOperation({ summary: 'Create department (Portal 35.1 master data)' })
  @ApiCreatedResponse({ type: DepartmentResponseDto })
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @RequireAnyPermissions(
    'enterprise.manage',
    'operations.manage',
    'users.manage',
  )
  @ApiOperation({ summary: 'List departments' })
  @ApiOkResponse({ type: [DepartmentResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }

  @Patch(':id')
  @RequirePermissions('enterprise.manage')
  @ApiOperation({ summary: 'Update department name or deactivate' })
  @ApiOkResponse({ type: DepartmentResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }
}
