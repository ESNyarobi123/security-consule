import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EmployeeStatus, EmploymentType } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequirePermissions,
} from '@pssms/shared';
import { BranchStaffService } from '../application/branch-staff.service';
import {
  BranchStaffRowDto,
  CreateBranchStaffDto,
  UpdateBranchStaffDto,
} from './dto/branch-staff.dto';

/**
 * Portal 35.23 — Branch staff register.
 * Living under `/operations` keeps the Branch Ops surface in one API area while
 * the employee record itself stays owned by the workforce (HR) domain.
 */
@ApiTags('Operations — Branch staff')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('operations.manage')
@Controller('operations/branch-staff')
export class BranchStaffController {
  constructor(private readonly service: BranchStaffService) {}

  @Get()
  @ApiOperation({
    summary:
      'Branch-scoped employee roster (add/edit/deactivate office staff in your branch)',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: EmployeeStatus })
  @ApiQuery({ name: 'employmentType', required: false, enum: EmploymentType })
  @ApiQuery({ name: 'q', required: false })
  @ApiOkResponse({ type: [BranchStaffRowDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('status') status?: EmployeeStatus,
    @Query('employmentType') employmentType?: EmploymentType,
    @Query('q') q?: string,
  ) {
    return this.service.list(user, { branchId, status, employmentType, q });
  }

  @Post()
  @ApiOperation({ summary: 'Add a staff member to a branch in your scope' })
  create(@Body() dto: CreateBranchStaffDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Edit branch staff (profile / department / branch transfer / suspend)',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }
}
