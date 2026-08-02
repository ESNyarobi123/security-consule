import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  RequireAnyPermissions,
  RequirePermissions,
  resolveCustomerScope,
} from '@pssms/shared';
import { CustomersService } from '../application/customers.service';
import { CustomerPortalOpsService } from '../application/customer-portal-ops.service';
import { CustomerPortalUsersService } from '../application/customer-portal-users.service';
import { CustomerServiceRequestsService } from '../application/customer-service-requests.service';
import {
  CreateCustomerDto,
  CustomerResponseDto,
  UpdateCustomerDto,
} from './dto/customer.dto';
import {
  InviteCustomerPortalUserDto,
  InviteCustomerPortalUserResponseDto,
  PortalUserResponseDto,
} from './dto/customer-portal-user.dto';
import {
  CreateServiceRequestDto,
  ServiceRequestResponseDto,
  UpdateServiceRequestStatusDto,
} from './dto/service-request.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly service: CustomersService,
    private readonly portalOps: CustomerPortalOpsService,
    private readonly portalUsers: CustomerPortalUsersService,
    private readonly serviceRequests: CustomerServiceRequestsService,
  ) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Register customer',
    description:
      'Commercial customer master data (company, contacts, address). Sites are linked via enterprise sites; service types live on contracts.',
  })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: 'Update customer profile / active flag' })
  @ApiOkResponse({ type: CustomerResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Current customer profile (CUSTOMER_PORTAL users)',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user);
  }

  @Get('me/sites')
  @ApiOperation({
    summary: 'Customer portal — sites linked to the scoped customer',
  })
  meSites(@CurrentUser() user: AuthUser) {
    return this.portalOps.listSites(user);
  }

  @Get('me/deployments')
  @ApiOperation({
    summary:
      'Customer portal — ACTIVE (and recent ENDED) deployments at customer sites',
  })
  meDeployments(@CurrentUser() user: AuthUser) {
    return this.portalOps.listDeployments(user);
  }

  @Get('me/incidents')
  @ApiOperation({
    summary: 'Customer portal — incidents at customer sites (read-only)',
  })
  meIncidents(@CurrentUser() user: AuthUser) {
    return this.portalOps.listIncidents(user);
  }

  @Get('me/attendance-summary')
  @ApiOperation({
    summary:
      'Customer portal — per-site clock-ins today + active deployment counts',
  })
  meAttendanceSummary(@CurrentUser() user: AuthUser) {
    return this.portalOps.attendanceSummary(user);
  }

  @Get('me/service-requests')
  @ApiOperation({
    summary: 'Customer portal — list own service requests',
  })
  @ApiOkResponse({ type: [ServiceRequestResponseDto] })
  meServiceRequests(@CurrentUser() user: AuthUser) {
    return this.serviceRequests.listForPortal(user);
  }

  @Post('me/service-requests')
  @ApiOperation({
    summary: 'Customer portal — create a service request ticket',
  })
  @ApiCreatedResponse({ type: ServiceRequestResponseDto })
  createMeServiceRequest(
    @Body() dto: CreateServiceRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.serviceRequests.createForPortal(dto, user);
  }

  @Post('me/service-requests/:id/cancel')
  @ApiOperation({
    summary: 'Customer portal — cancel own OPEN service request',
  })
  @ApiOkResponse({ type: ServiceRequestResponseDto })
  cancelMeServiceRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.serviceRequests.cancelForPortal(id, user);
  }

  @Get('service-requests')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('customers.manage', 'visitors.manage')
  @ApiOperation({
    summary: 'Staff/call centre — list org service requests',
  })
  @ApiOkResponse({ type: [ServiceRequestResponseDto] })
  listServiceRequests(@CurrentUser() user: AuthUser) {
    return this.serviceRequests.listForStaff(user);
  }

  @Patch('service-requests/:id')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('customers.manage', 'visitors.manage')
  @ApiOperation({
    summary: 'Staff/call centre — update service request status',
    description:
      'Creator ≠ processor (SoD). OPEN→ACKNOWLEDGED→IN_PROGRESS→RESOLVED→CLOSED.',
  })
  @ApiOkResponse({ type: ServiceRequestResponseDto })
  updateServiceRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceRequestStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.serviceRequests.updateStatusForStaff(id, dto, user);
  }

  @Get(':id/portal-users')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'List customer portal users bound to this customer',
  })
  @ApiOkResponse({ type: [PortalUserResponseDto] })
  listPortalUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.portalUsers.list(id, user.organizationId);
  }

  @Post(':id/portal-users')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Invite a CUSTOMER_PORTAL user for this customer',
    description:
      'Creates an org user bound to customerId with CUSTOMER_PORTAL role. Returns a one-time temporary password (also queued as EMAIL when notifications are up).',
  })
  @ApiCreatedResponse({ type: InviteCustomerPortalUserResponseDto })
  invitePortalUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteCustomerPortalUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.portalUsers.invite(id, dto, user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Customer detail with linked sites',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const scoped = resolveCustomerScope(user);
    return this.service.getById(id, user.organizationId, scoped);
  }

  @Get()
  @ApiOperation({ summary: 'List customers in organization' })
  @ApiOkResponse({ type: [CustomerResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    const scoped = resolveCustomerScope(user);
    return this.service.list(user.organizationId, scoped);
  }
}
