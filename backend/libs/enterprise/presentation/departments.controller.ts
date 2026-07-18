import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { DepartmentsService } from '../application/departments.service';
import {
  CreateDepartmentDto,
  DepartmentResponseDto,
} from './dto/enterprise.dto';

@ApiTags('Enterprise')
@ApiBearerAuth()
@Controller('enterprise/departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create department' })
  @ApiCreatedResponse({ type: DepartmentResponseDto })
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List departments' })
  @ApiOkResponse({ type: [DepartmentResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }
}
