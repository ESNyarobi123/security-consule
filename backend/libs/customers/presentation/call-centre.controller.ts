import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import { CallCentreService } from '../application/call-centre.service';
import {
  CreateStaffServiceRequestDto,
  ServiceRequestResponseDto,
} from './dto/service-request.dto';

@ApiTags('Call Centre / Support')
@ApiBearerAuth()
@Controller('callcentre')
@UseGuards(PermissionsGuard)
@RequirePermissions('visitors.manage')
export class CallCentreController {
  constructor(private readonly desk: CallCentreService) {}

  @Get('ticket-options')
  @ApiOperation({ summary: 'Support ticket category catalog (Portal 35.20)' })
  ticketOptions() {
    return this.desk.ticketOptions();
  }

  @Get('customer-options')
  @ApiOperation({
    summary: 'Thin customer picker for logging tickets/complaints',
  })
  customerOptions(@CurrentUser() user: AuthUser) {
    return this.desk.customerOptions(user);
  }

  @Get('reports')
  @ApiOkResponse({ description: 'Live support-desk counts' })
  reports(@CurrentUser() user: AuthUser) {
    return this.desk.reports(user);
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
