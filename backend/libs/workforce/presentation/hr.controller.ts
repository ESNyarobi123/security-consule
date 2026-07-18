import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '@pssms/shared';
import { EmployeesService } from '../application/employees.service';
import { LeaveService } from '../application/leave.service';
import { SalaryService } from '../application/salary.service';
import { CreateEmployeeDto, EmployeeResponseDto } from './dto/employee.dto';
import {
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  LeaveRequestResponseDto,
  LeaveTypeResponseDto,
} from './dto/leave.dto';
import {
  CreateSalaryAssignmentDto,
  SalaryAssignmentResponseDto,
} from './dto/salary.dto';

@ApiTags('HR — Employees')
@ApiBearerAuth()
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
  @ApiOkResponse({ type: [EmployeeResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId);
  }
}

@ApiTags('HR — Leave')
@ApiBearerAuth()
@Controller('hr/leave')
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @Post('types')
  @ApiOperation({ summary: 'Create leave type' })
  @ApiCreatedResponse({ type: LeaveTypeResponseDto })
  createType(@Body() dto: CreateLeaveTypeDto, @CurrentUser() user: AuthUser) {
    return this.service.createLeaveType(dto, user);
  }

  @Get('types')
  @ApiOperation({ summary: 'List leave types' })
  @ApiOkResponse({ type: [LeaveTypeResponseDto] })
  listTypes(@CurrentUser() user: AuthUser) {
    return this.service.listLeaveTypes(user.organizationId);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Apply for leave (starts approval workflow)' })
  @ApiCreatedResponse({ type: LeaveRequestResponseDto })
  apply(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.applyLeave(dto, user);
  }

  @Post('requests/:id/approve')
  @ApiOperation({ summary: 'Approve leave request' })
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveLeave(id, user);
  }

  @Get('requests')
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
