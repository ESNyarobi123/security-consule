import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  RequireAnyPermissions,
} from '@pssms/shared';
import { CallCentreService } from '../application/call-centre.service';
import {
  CreateStaffServiceRequestDto,
  ServiceRequestResponseDto,
} from './dto/service-request.dto';

@ApiTags('Call Centre / Support')
@ApiBearerAuth()
@Controller('callcentre')
@UseGuards(PermissionsGuard)
@RequireAnyPermissions('support.manage', 'visitors.manage')
export class CallCentreController {
  constructor(private readonly desk: CallCentreService) {}

  @Get('ticket-options')
  @ApiOperation({ summary: 'Support ticket category catalog (Portal 35.20)' })
  ticketOptions() {
    return this.desk.ticketOptions();
  }

  @Get('complaint-options')
  @ApiOperation({
    summary: 'Complaint category / severity catalog (Portal 35.20)',
  })
  complaintOptions() {
    return this.desk.complaintOptions();
  }

  @Get('customer-options')
  @ApiOperation({
    summary: 'Thin customer picker for logging tickets/complaints',
  })
  customerOptions(@CurrentUser() user: AuthUser) {
    return this.desk.customerOptions(user);
  }

  @Get('site-options')
  @ApiOperation({
    summary: 'Active sites for a customer (ticket escalation binding)',
  })
  siteOptions(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId: string,
  ) {
    return this.desk.siteOptions(user, customerId);
  }

  @Get('reports')
  @ApiOkResponse({ description: 'Live support-desk counts' })
  reports(@CurrentUser() user: AuthUser) {
    return this.desk.reports(user);
  }

  @Get('visitors')
  @ApiOperation({
    summary: 'Read-only visitor support view (support.manage)',
  })
  visitorDesk(@CurrentUser() user: AuthUser) {
    return this.desk.visitorDesk(user);
  }

  @Post('tickets')
  @ApiCreatedResponse({ type: ServiceRequestResponseDto })
  @ApiOperation({ summary: 'Log inbound support ticket (staff)' })
  createTicket(
    @Body() dto: CreateStaffServiceRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.desk.createTicket(dto, user);
  }

  @Post('tickets/:id/escalate-incident')
  @ApiOperation({
    summary: 'Escalate ticket to an OPEN incident (IncidentsService)',
  })
  escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.desk.escalateTicket(id, user);
  }
}
