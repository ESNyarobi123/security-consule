import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
  Public,
  RequireAnyPermissions,
  RequirePermissions,
  requireCustomerScope,
  resolveCustomerScope,
} from '@pssms/shared';
import { AccessControlService } from '../application/access-control.service';
import {
  CreateAccessEntryDto,
  CreateSelfAccessEntryDto,
  CreateCustomerEmployeeDto,
  CustomerEmployeeResponseDto,
  AccessEntryResponseDto,
  AccessMethodOptionDto,
  RegisterCustomerEmployeeAccessDto,
  RegisterCustomerEmployeeAccessResponseDto,
  SelfAccessSitesResponseDto,
} from './dto/access.dto';

@ApiTags('Access Control')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('access')
export class AccessControlController {
  constructor(private readonly service: AccessControlService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary:
      'Portal 35.9 — employee self-register against an existing customer roster (no new employee record)',
  })
  @ApiCreatedResponse({ type: RegisterCustomerEmployeeAccessResponseDto })
  register(@Body() dto: RegisterCustomerEmployeeAccessDto) {
    return this.service.register(dto);
  }

  @Get('method-options')
  @RequireAnyPermissions('access.self', 'access.manage')
  @ApiOperation({
    summary: 'Portal 35.9 — access methods for self check-in (QR/card/bio/PIN)',
  })
  @ApiOkResponse({ type: [AccessMethodOptionDto] })
  methodOptions() {
    return this.service.accessMethodOptions();
  }

  @Get('me')
  @RequireAnyPermissions('access.self', 'access.manage')
  @ApiOperation({
    summary: 'Own customer-employee profile (Portal 35.9 self)',
  })
  @ApiOkResponse({ type: CustomerEmployeeResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return this.service.getMyEmployee(user);
  }

  @Post('me/entries')
  @RequirePermissions('access.self')
  @ApiOperation({
    summary:
      'Self check-in/out (Portal 35.9) — bound employee + own customer sites only',
  })
  @ApiCreatedResponse({ type: AccessEntryResponseDto })
  recordSelfEntry(
    @Body() dto: CreateSelfAccessEntryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordSelfEntry(dto, user);
  }

  @Get('me/sites')
  @RequirePermissions('access.self')
  @ApiOperation({
    summary:
      'Sites allowed for self check-in (Module 11-C). Empty grants = all customer sites.',
  })
  @ApiOkResponse({ type: SelfAccessSitesResponseDto })
  mySites(@CurrentUser() user: AuthUser) {
    return this.service.listMySites(user);
  }

  @Post('me/verify-identity')
  @RequirePermissions('access.self')
  @ApiOperation({
    summary: 'Portal 35.9 — confirm own identity details on file',
  })
  @ApiOkResponse({ type: CustomerEmployeeResponseDto })
  verifyMyIdentity(@CurrentUser() user: AuthUser) {
    return this.service.verifyMyIdentity(user);
  }

  @Post('employees')
  @RequirePermissions('access.manage')
  @ApiOperation({ summary: 'Register customer employee for site access' })
  @ApiCreatedResponse({ type: CustomerEmployeeResponseDto })
  createEmployee(
    @Body() dto: CreateCustomerEmployeeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createEmployee(dto, user);
  }

  @Get('employees')
  @RequirePermissions('access.manage')
  @ApiOperation({
    summary:
      'List customer employees (customer-scoped; portal users force-scoped)',
  })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiOkResponse({ type: [CustomerEmployeeResponseDto] })
  listEmployees(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
  ) {
    const scoped = requireCustomerScope(user, customerId);
    return this.service.listEmployees(scoped, user);
  }

  @Post('entries')
  @RequirePermissions('access.manage')
  @ApiOperation({ summary: 'Record customer employee check-in/out' })
  @ApiCreatedResponse({ type: AccessEntryResponseDto })
  recordEntry(
    @Body() dto: CreateAccessEntryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordEntry(dto, user);
  }

  @Get('entries')
  @RequireAnyPermissions('access.manage', 'access.self')
  @ApiOperation({
    summary:
      'List access entries (staff/portal customer-scoped; employee = own only)',
  })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({ type: [AccessEntryResponseDto] })
  listEntries(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
    @Query('siteId') siteId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // Portal JWT always force-scoped; staff may pass customerId optionally.
    const scoped = user.customerId
      ? requireCustomerScope(user, customerId)
      : resolveCustomerScope(user, customerId);
    return this.service.listEntries(user, scoped, siteId, employeeId, from, to);
  }
}
