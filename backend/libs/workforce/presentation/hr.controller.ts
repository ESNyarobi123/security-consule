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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EmployeeStatus } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequireAnyPermissions,
  RequirePermissions,
} from '@pssms/shared';
import { EmployeesService } from '../application/employees.service';
import { LeaveService } from '../application/leave.service';
import { SalaryService } from '../application/salary.service';
import { TrainingService } from '../application/training.service';
import { DisciplineService } from '../application/discipline.service';
import { MovementService } from '../application/movement.service';
import {
  CreateEmployeeDto,
  EmployeeResponseDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';
import {
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  LeaveRequestResponseDto,
  LeaveTypeResponseDto,
  RejectLeaveRequestDto,
} from './dto/leave.dto';
import {
  CreateSalaryAssignmentDto,
  SalaryAssignmentResponseDto,
} from './dto/salary.dto';
import {
  CreateTrainingRecordDto,
  TrainingRecordResponseDto,
  UpdateTrainingRecordDto,
} from './dto/training.dto';
import {
  CreateDisciplineCaseDto,
  DisciplineCaseResponseDto,
  UpdateDisciplineCaseDto,
} from './dto/discipline.dto';
import {
  CreateEmployeeMovementDto,
  EmployeeMovementResponseDto,
  RejectEmployeeMovementDto,
} from './dto/movement.dto';

@ApiTags('HR — Employees')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('hr.manage')
@Controller('hr/employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Create employee record' })
  @ApiCreatedResponse({ type: EmployeeResponseDto })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List employees' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: EmployeeStatus,
    description:
      'Filter by status. Omit to exclude TERMINATED; pass TERMINATED to include leavers.',
  })
  @ApiOkResponse({ type: [EmployeeResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: EmployeeStatus,
  ) {
    return this.service.list(user.organizationId, status);
  }

  @Get('linkable-users')
  @ApiOperation({
    summary: 'List org users for ESS account linking (id/email/name only)',
  })
  listLinkableUsers(@CurrentUser() user: AuthUser) {
    return this.service.listLinkableUsers(user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee by id' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.get(id, user.organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee profile fields' })
  @ApiOkResponse({ type: EmployeeResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }
}

@ApiTags('HR — Leave')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('hr/leave')
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @Post('types')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Create leave type' })
  @ApiCreatedResponse({ type: LeaveTypeResponseDto })
  createType(@Body() dto: CreateLeaveTypeDto, @CurrentUser() user: AuthUser) {
    return this.service.createLeaveType(dto, user);
  }

  @Get('types')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'List leave types' })
  @ApiOkResponse({ type: [LeaveTypeResponseDto] })
  listTypes(@CurrentUser() user: AuthUser) {
    return this.service.listLeaveTypes(user.organizationId);
  }

  @Post('requests')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Apply for leave (starts approval workflow)' })
  @ApiCreatedResponse({ type: LeaveRequestResponseDto })
  apply(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.applyLeave(dto, user);
  }

  @Post('requests/:id/approve')
  @RequireAnyPermissions('hr.manage', 'approvals.act')
  @ApiOperation({
    summary: 'Approve leave request (current matrix step)',
    description:
      '§4 A5: Supervisor → HR → Dept Head → GM. Use domain route so LeaveRequest status syncs.',
  })
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveLeave(id, user);
  }

  @Post('requests/:id/reject')
  @RequireAnyPermissions('hr.manage', 'approvals.act')
  @ApiOperation({ summary: 'Reject leave request' })
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.rejectLeave(id, dto, user);
  }

  @Get('requests')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'List leave requests' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiOkResponse({ type: [LeaveRequestResponseDto] })
  listRequests(
    @CurrentUser() user: AuthUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.listLeaveRequests(user.organizationId, employeeId);
  }
}

@ApiTags('HR — Salary')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('hr.manage')
@Controller('hr/salary')
export class SalaryController {
  constructor(private readonly service: SalaryService) {}

  @Post('assignments')
  @ApiOperation({ summary: 'Assign salary to employee' })
  @ApiCreatedResponse({ type: SalaryAssignmentResponseDto })
  assign(
    @Body() dto: CreateSalaryAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assign(dto, user);
  }

  @Get('assignments')
  @ApiOperation({ summary: 'List salary assignments' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiOkResponse({ type: [SalaryAssignmentResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.list(user.organizationId, employeeId);
  }
}

@ApiTags('HR — Training')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('hr.manage')
@Controller('hr/training')
export class TrainingController {
  constructor(private readonly service: TrainingService) {}

  @Post('records')
  @ApiOperation({ summary: 'Create training record' })
  @ApiCreatedResponse({ type: TrainingRecordResponseDto })
  create(
    @Body() dto: CreateTrainingRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user);
  }

  @Patch('records/:id')
  @ApiOperation({ summary: 'Update training record' })
  @ApiOkResponse({ type: TrainingRecordResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTrainingRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Get('records')
  @ApiOperation({ summary: 'List training records' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiOkResponse({ type: [TrainingRecordResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.list(user.organizationId, employeeId);
  }
}

@ApiTags('HR — Discipline')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('hr.manage')
@Controller('hr/discipline')
export class DisciplineController {
  constructor(private readonly service: DisciplineService) {}

  @Post('cases')
  @ApiOperation({ summary: 'Open discipline case' })
  @ApiCreatedResponse({ type: DisciplineCaseResponseDto })
  create(
    @Body() dto: CreateDisciplineCaseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user);
  }

  @Patch('cases/:id')
  @ApiOperation({ summary: 'Update / close discipline case' })
  @ApiOkResponse({ type: DisciplineCaseResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDisciplineCaseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Get('cases')
  @ApiOperation({ summary: 'List discipline cases' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiOkResponse({ type: [DisciplineCaseResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.list(user.organizationId, employeeId);
  }
}

@ApiTags('HR — Movements')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('hr.manage')
@Controller('hr/movements')
export class MovementsController {
  constructor(private readonly service: MovementService) {}

  @Post()
  @ApiOperation({
    summary: 'Request transfer or exit (starts approval workflow)',
  })
  @ApiCreatedResponse({ type: EmployeeMovementResponseDto })
  create(
    @Body() dto: CreateEmployeeMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve transfer/exit' })
  @ApiOkResponse({ type: EmployeeMovementResponseDto })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject transfer/exit' })
  @ApiOkResponse({ type: EmployeeMovementResponseDto })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectEmployeeMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List transfer/exit requests' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiOkResponse({ type: [EmployeeMovementResponseDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.list(user.organizationId, employeeId);
  }
}
