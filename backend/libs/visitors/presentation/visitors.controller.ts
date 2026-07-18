import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
  Public,
  resolveCustomerScope,
} from '@pssms/shared';
import { VisitorsService } from '../application/visitors.service';
import {
  CreateVisitorAppointmentDto,
  GateVerifyDto,
  GateVerifyResponseDto,
  IssueCodeResponseDto,
  RejectAppointmentDto,
  VisitorAppointmentResponseDto,
  VisitorEntryResponseDto,
} from './dto/visitor.dto';

@ApiTags('Visitors')
@Controller('visitors')
export class VisitorsController {
  constructor(private readonly service: VisitorsService) {}

  @Public()
  @Get('public-config')
  @ApiOperation({
    summary: 'Demo public visitor booking config (org/customer/site UUIDs)',
  })
  @ApiOkResponse({ description: 'IDs for visitor-web pre-registration form' })
  publicConfig() {
    return this.service.publicConfig();
  }

  @Public()
  @Post('appointments')
  @ApiOperation({ summary: 'Pre-register visitor appointment (public or authenticated)' })
  @ApiCreatedResponse({ type: VisitorAppointmentResponseDto })
  createAppointment(
    @Body() dto: CreateVisitorAppointmentDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.service.createAppointment(dto, user);
  }

  @Get('appointments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List visitor appointments' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: AppointmentStatus })
  @ApiOkResponse({ type: [VisitorAppointmentResponseDto] })
  listAppointments(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
    @Query('siteId') siteId?: string,
    @Query('status') status?: AppointmentStatus,
  ) {
    const scoped = resolveCustomerScope(user, customerId);
    return this.service.listAppointments(user, scoped, siteId, status);
  }

  @Post('appointments/:id/approve')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Host approves appointment and issues verification code' })
  @ApiOkResponse({ type: IssueCodeResponseDto })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveAppointment(id, user);
  }

  @Post('appointments/:id/reject')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Host rejects visitor appointment' })
  @ApiOkResponse({ type: VisitorAppointmentResponseDto })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.rejectAppointment(id, dto, user);
  }

  @Post('gate/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gate officer verifies visitor code' })
  @ApiOkResponse({ type: GateVerifyResponseDto })
  gateVerify(@Body() dto: GateVerifyDto, @CurrentUser() user: AuthUser) {
    return this.service.gateVerify(dto, user);
  }

  @Get('entries')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List visitor gate entries' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: [VisitorEntryResponseDto] })
  listEntries(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
  ) {
    return this.service.listEntries(user, siteId);
  }
}
