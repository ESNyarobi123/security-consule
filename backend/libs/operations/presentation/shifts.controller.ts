import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { ShiftsService } from '../application/shifts.service';
import {
  CreateShiftDto,
  ReplaceShiftAssignmentDto,
  ShiftResponseDto,
} from './dto/operations.dto';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@RequirePermissions('operations.manage')
@Controller('operations/shifts')
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Post()
  @ApiOperation({ summary: 'Create shift with guard assignments' })
  @ApiCreatedResponse({ type: ShiftResponseDto })
  create(@Body() dto: CreateShiftDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List shifts' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: [ShiftResponseDto] })
  list(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.list(user.organizationId, user, siteId);
  }

  @Post(':id/assignments/:assignmentId/confirm')
  @ApiOperation({
    summary:
      'Confirm a guard is on this shift (assigned guard cannot confirm themselves)',
  })
  @ApiOkResponse({ type: ShiftResponseDto })
  confirmAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.confirmAssignment(id, assignmentId, user);
  }

  @Post(':id/assignments/:assignmentId/replace')
  @ApiOperation({
    summary:
      'Replace a guard on this shift (outgoing guard cannot process their own replace)',
  })
  @ApiOkResponse({ type: ShiftResponseDto })
  replaceAssignment(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReplaceShiftAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.replaceAssignment(id, assignmentId, dto, user);
  }
}
