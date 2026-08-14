import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { AccessControlService } from '@pssms/access-control';
import { UpdateCustomerEmployeePaymentDto } from '@pssms/access-control/presentation/dto/access.dto';
import { SitesService } from '@pssms/enterprise';
import { CustomerSalaryService, PayrollDueService, PayrollService } from '@pssms/payroll';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequireAnyPermissions,
  RequirePermissions,
  resolveCustomerScope,
} from '@pssms/shared';
import { CustomersService } from '../application/customers.service';
import { CustomerComplaintsService } from '../application/customer-complaints.service';
import { CustomerContactsService } from '../application/customer-contacts.service';
import { CustomerOverviewService } from '../application/customer-overview.service';
import { CustomerPortalOpsService } from '../application/customer-portal-ops.service';
import { CustomerEmployeePortalService } from '../application/customer-employee-portal.service';
import { CustomerPortalUsersService } from '../application/customer-portal-users.service';
import { CustomerReportsService } from '../application/customer-reports.service';
import { CustomerServiceRequestsService } from '../application/customer-service-requests.service';
import {
  CreateCustomerDto,
  CustomerResponseDto,
  UpdateCustomerDto,
} from './dto/customer.dto';
import { CustomerOverviewResponseDto } from './dto/customer-overview.dto';
import {
  CustomerAssignedGuardResponseDto,
  CustomerGuardsQueryDto,
} from './dto/customer-guards.dto';
import {
  CustomerReportQueryDto,
  CustomerReportResponseDto,
} from './dto/customer-report.dto';
import {
  InviteCustomerPortalUserDto,
  InviteCustomerPortalUserResponseDto,
  PortalUserResponseDto,
} from './dto/customer-portal-user.dto';
import {
  ComplaintResponseDto,
  CreateComplaintDto,
  CreateStaffComplaintDto,
  UpdateComplaintStatusDto,
} from './dto/complaint.dto';
import {
  CreateServiceRequestDto,
  ServiceRequestResponseDto,
  UpdateServiceRequestStatusDto,
} from './dto/service-request.dto';
import {
  CreateCustomerSiteDto,
  CustomerSiteResponseDto,
  UpdateCustomerSiteDto,
} from './dto/customer-site.dto';
import {
  CreateCustomerEmployeeForCustomerDto,
  CustomerEmployeeSitesResponseDto,
  CustomerEmployeeStaffResponseDto,
  SetCustomerEmployeeSitesDto,
  UpdateCustomerEmployeeForCustomerDto,
} from './dto/customer-employee.dto';
import { InviteCustomerEmployeePortalResponseDto } from './dto/customer-employee-portal.dto';
import {
  CreateCustomerSalaryAssignmentDto,
  CustomerSalaryAssignmentResponseDto,
  UpdateCustomerSalaryAssignmentDto,
} from '@pssms/payroll/presentation/dto/customer-payroll.dto';
import {
  PayrollCycleResponseDto,
  PayslipSnapshotResponseDto,
} from '@pssms/payroll/presentation/dto/payroll.dto';
import { PayrollDueAlertResponseDto } from '@pssms/payroll/presentation/dto/payroll-due.dto';
import {
  CreateCustomerContactDto,
  CustomerContactResponseDto,
  UpdateCustomerContactDto,
} from './dto/customer-contact.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly service: CustomersService,
    private readonly overview: CustomerOverviewService,
    private readonly reports: CustomerReportsService,
    private readonly portalOps: CustomerPortalOpsService,
    private readonly portalUsers: CustomerPortalUsersService,
    private readonly employeePortal: CustomerEmployeePortalService,
    private readonly serviceRequests: CustomerServiceRequestsService,
    private readonly complaints: CustomerComplaintsService,
    private readonly contacts: CustomerContactsService,
    private readonly sites: SitesService,
    private readonly access: AccessControlService,
    private readonly payroll: PayrollService,
    private readonly customerSalary: CustomerSalaryService,
    private readonly payrollDue: PayrollDueService,
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

  @Get('me/reports')
  @ApiOperation({
    summary: 'Customer portal — own report pack (Module 6-C)',
    description: 'Period aggregates for the scoped customer (default last 30 days).',
  })
  @ApiOkResponse({ type: CustomerReportResponseDto })
  meReports(
    @Query() query: CustomerReportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.reportForPortal(user, query.from, query.to);
  }

  @Get('me/complaints')
  @ApiOperation({ summary: 'Customer portal — list own complaints (Module 6-B)' })
  @ApiOkResponse({ type: [ComplaintResponseDto] })
  meComplaints(@CurrentUser() user: AuthUser) {
    return this.complaints.listForPortal(user);
  }

  @Post('me/complaints')
  @ApiOperation({ summary: 'Customer portal — file a complaint' })
  @ApiCreatedResponse({ type: ComplaintResponseDto })
  createMeComplaint(
    @Body() dto: CreateComplaintDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.complaints.createForPortal(dto, user);
  }

  @Post('me/complaints/:id/cancel')
  @ApiOperation({ summary: 'Customer portal — cancel own OPEN complaint' })
  @ApiOkResponse({ type: ComplaintResponseDto })
  cancelMeComplaint(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.complaints.cancelForPortal(id, user);
  }

  @Get('me/contacts')
  @ApiOperation({
    summary: 'Customer portal — list active contacts (Module 6-M)',
    description: 'Read-only directory for the scoped customer.',
  })
  @ApiOkResponse({ type: [CustomerContactResponseDto] })
  meContacts(@CurrentUser() user: AuthUser) {
    return this.contacts.listForPortal(user);
  }

  @Get('me/payroll/cycles')
  @ApiOperation({
    summary: 'Customer portal — payroll cycles (Module 19-A)',
    description:
      'CUSTOMER_MANAGED_PAYROLL cycles for the scoped customer only.',
  })
  @ApiOkResponse({ type: [PayrollCycleResponseDto] })
  mePayrollCycles(@CurrentUser() user: AuthUser) {
    return this.payroll.listCyclesForCustomerPortal(user);
  }

  @Get('me/payroll/due-alerts')
  @ApiOperation({
    summary: 'Customer portal — e-payroll due alerts (Module 20-A)',
    description: 'Own customer only. Alerts appear after invoice is fully paid.',
  })
  @ApiOkResponse({ type: [PayrollDueAlertResponseDto] })
  mePayrollDueAlerts(@CurrentUser() user: AuthUser) {
    return this.payrollDue.listAlertsForCustomerPortal(user);
  }

  @Get('me/payroll/cycles/:cycleId/payslips')
  @ApiOperation({
    summary: 'Customer portal — payslips for a payroll cycle (Module 19-A)',
  })
  @ApiOkResponse({ type: [PayslipSnapshotResponseDto] })
  mePayrollCyclePayslips(
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payroll.listPayslipsForCustomerPortal(cycleId, user);
  }

  @Get('me/payroll/payslips/:payslipId')
  @ApiOperation({
    summary: 'Customer portal — payslip detail (Module 19-A)',
  })
  @ApiOkResponse({ type: PayslipSnapshotResponseDto })
  mePayrollPayslip(
    @Param('payslipId', ParseUUIDPipe) payslipId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payroll.getPayslipForCustomerPortal(payslipId, user);
  }

  @Get('me/payroll/my-payslips')
  @ApiOperation({
    summary: 'Customer employee — own payslips (Module 19-A)',
    description:
      'CUSTOMER_EMPLOYEE self-scope via linked CustomerEmployee.userId.',
  })
  @ApiOkResponse({ type: [PayslipSnapshotResponseDto] })
  meMyPayslips(@CurrentUser() user: AuthUser) {
    return this.payroll.listMyPayslipsForEmployee(user);
  }

  @Get('complaints')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('customers.manage', 'visitors.manage')
  @ApiOperation({ summary: 'Staff/call centre — list org complaints' })
  @ApiOkResponse({ type: [ComplaintResponseDto] })
  listComplaints(@CurrentUser() user: AuthUser) {
    return this.complaints.listForStaff(user);
  }

  @Post('complaints')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('customers.manage', 'visitors.manage')
  @ApiOperation({
    summary: 'Staff/call centre — log a complaint for a customer',
  })
  @ApiCreatedResponse({ type: ComplaintResponseDto })
  createComplaint(
    @Body() dto: CreateStaffComplaintDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.complaints.createForStaff(dto, user);
  }

  @Patch('complaints/:id')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('customers.manage', 'visitors.manage')
  @ApiOperation({
    summary: 'Staff/call centre — update complaint status',
    description:
      'Creator ≠ processor (SoD). OPEN→ACKNOWLEDGED→UNDER_REVIEW→RESOLVED→CLOSED.',
  })
  @ApiOkResponse({ type: ComplaintResponseDto })
  updateComplaint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplaintStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.complaints.updateStatusForStaff(id, dto, user);
  }

  @Get(':id/overview')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Staff customer 360 overview (Module 6-A)',
    description:
      'Org-scoped counts + recent samples: sites, contracts, employees, guards, invoices/payment, service requests, incidents, parking, access, pending visits.',
  })
  @ApiOkResponse({ type: CustomerOverviewResponseDto })
  getOverview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.overview.getOverview(id, user);
  }

  @Get(':id/guards')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'List guards assigned to this customer (Module 6-L)',
    description:
      'Read-only roster of GuardDeployments on customer sites (default ACTIVE). Deploy/end remains Branch Ops. Cap 200.',
  })
  @ApiOkResponse({ type: [CustomerAssignedGuardResponseDto] })
  listAssignedGuards(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomerGuardsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.overview.listAssignedGuards(id, user, query.status ?? 'ACTIVE');
  }

  @Get(':id/contacts')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'List customer contacts (Module 6-M)',
    description:
      'Multi-person directory beyond scalar contactPerson. Primary syncs profile scalars.',
  })
  @ApiOkResponse({ type: [CustomerContactResponseDto] })
  listContacts(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contacts.listForStaff(id, user);
  }

  @Post(':id/contacts')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Add a customer contact (Module 6-M)',
    description:
      'Audit: customer.contact.created. Setting isPrimary clears other primaries and syncs contactPerson/designation.',
  })
  @ApiCreatedResponse({ type: CustomerContactResponseDto })
  createContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCustomerContactDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contacts.create(id, dto, user);
  }

  @Patch(':id/contacts/:contactId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Update/deactivate a customer contact (Module 6-M)',
    description: 'Audit: customer.contact.updated. Contact must belong to :id.',
  })
  @ApiOkResponse({ type: CustomerContactResponseDto })
  updateContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateCustomerContactDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contacts.update(id, contactId, dto, user);
  }

  @Get(':id/reports')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Staff customer report pack (Module 6-C)',
    description:
      'Period aggregates: incidents, attendance, access, visitors, parking, complaints, invoices — by site. Default window last 30 days.',
  })
  @ApiOkResponse({ type: CustomerReportResponseDto })
  getReports(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomerReportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.reportForStaff(id, user, query.from, query.to);
  }

  @Post(':id/sites')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Create a site linked to this customer (Module 6-E)',
    description:
      'CRM-gated wrapper over enterprise SitesService. Forces customerId from the path; validates branch/org and unique site code. Audit: site.created.',
  })
  @ApiCreatedResponse({ type: CustomerSiteResponseDto })
  async createSite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCustomerSiteDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.service.getById(id, user.organizationId);
    return this.sites.create(
      {
        branchId: dto.branchId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        address: dto.address?.trim() || undefined,
        customerId: id,
      },
      user,
    );
  }

  @Patch(':id/sites/:siteId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Update/deactivate a site linked to this customer (Module 6-F)',
    description:
      'CRM-gated SitesService.update. Site must belong to :id. Code/branch immutable. Audit: site.updated.',
  })
  @ApiOkResponse({ type: CustomerSiteResponseDto })
  async updateSite(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: UpdateCustomerSiteDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.service.getById(id, user.organizationId);
    return this.sites.update(siteId, dto, user, {
      requiredCustomerId: id,
    });
  }

  @Get(':id/employees')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'List customer employees for this customer (Module 6-G)',
    description:
      'CRM-gated wrapper over AccessControlService.listEmployees. Register-only roster (no portal userId bind).',
  })
  @ApiOkResponse({ type: [CustomerEmployeeStaffResponseDto] })
  async listEmployees(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.service.getById(id, user.organizationId);
    return this.access.listEmployees(id, user);
  }

  @Post(':id/employees')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Register a customer employee (Module 6-G)',
    description:
      'CRM-gated AccessControlService.createEmployee. Forces customerId from path. Audit: access.employee.created. Portal IAM bind deferred.',
  })
  @ApiCreatedResponse({ type: CustomerEmployeeStaffResponseDto })
  async createEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCustomerEmployeeForCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.service.getById(id, user.organizationId);
    return this.access.createEmployee(
      {
        customerId: id,
        fullName: dto.fullName.trim(),
        employeeNumber: dto.employeeNumber?.trim() || undefined,
        email: dto.email?.trim() || undefined,
        phone: dto.phone?.trim() || undefined,
        department: dto.department?.trim() || undefined,
        accessLevel: dto.accessLevel,
        accessCardRef: dto.accessCardRef?.trim() || undefined,
        biometricRef: dto.biometricRef?.trim() || undefined,
      },
      user,
    );
  }

  @Patch(':id/employees/:employeeId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Update/deactivate a customer employee (Module 6-H)',
    description:
      'CRM-gated AccessControlService.updateEmployee. Must belong to :id. Audit: access.employee.updated.',
  })
  @ApiOkResponse({ type: CustomerEmployeeStaffResponseDto })
  async updateEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateCustomerEmployeeForCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.service.getById(id, user.organizationId);
    return this.access.updateEmployee(employeeId, dto, user, {
      requiredCustomerId: id,
    });
  }

  @Get(':id/employees/:employeeId/sites')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'List site grants for a customer employee (Module 11-C)',
    description:
      'Empty grants = unrestricted (all active customer sites). Audit not required on read.',
  })
  @ApiOkResponse({ type: CustomerEmployeeSitesResponseDto })
  getEmployeeSites(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.access.getEmployeeSites(id, employeeId, user);
  }

  @Put(':id/employees/:employeeId/sites')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Replace site grants for a customer employee (Module 11-C)',
    description:
      'Empty siteIds clears grants (unrestricted). Sites must belong to the customer. Audit: access.employee.sites_updated.',
  })
  @ApiOkResponse({ type: CustomerEmployeeSitesResponseDto })
  setEmployeeSites(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: SetCustomerEmployeeSitesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.access.setEmployeeSites(id, employeeId, dto.siteIds, user);
  }

  @Post(':id/employees/:employeeId/invite-portal')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Invite CUSTOMER_EMPLOYEE portal login (Module 6-I)',
    description:
      'Creates User with CUSTOMER_EMPLOYEE + customerId + mustChangePassword, binds CustomerEmployee.userId. Uses employee email. One-time temp password. Audit: access.employee.portal_invited.',
  })
  @ApiCreatedResponse({ type: InviteCustomerEmployeePortalResponseDto })
  inviteEmployeePortal(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employeePortal.invite(id, employeeId, user);
  }

  @Get(':id/payroll/salary-assignments')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('customers.manage', 'payroll.manage')
  @ApiOperation({
    summary: 'List customer employee salary assignments (Module 19-A)',
  })
  @ApiOkResponse({ type: [CustomerSalaryAssignmentResponseDto] })
  listCustomerSalaryAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customerSalary.listForCustomer(id, user.organizationId);
  }

  @Post(':id/payroll/salary-assignments')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('customers.manage', 'payroll.manage')
  @ApiOperation({
    summary: 'Create customer employee salary assignment (Module 19-A)',
  })
  @ApiCreatedResponse({ type: CustomerSalaryAssignmentResponseDto })
  createCustomerSalaryAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCustomerSalaryAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customerSalary.create(id, dto, user);
  }

  @Patch(':id/payroll/salary-assignments/:assignmentId')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('customers.manage', 'payroll.manage')
  @ApiOperation({
    summary: 'Update customer employee salary assignment (Module 19-A)',
  })
  @ApiOkResponse({ type: CustomerSalaryAssignmentResponseDto })
  updateCustomerSalaryAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateCustomerSalaryAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customerSalary.update(id, assignmentId, dto, user);
  }

  @Patch(':id/employees/:employeeId/payment-instructions')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('customers.manage', 'payroll.manage')
  @ApiOperation({
    summary: 'Update customer employee payment instructions (Module 19-A)',
  })
  @ApiOkResponse({ type: CustomerEmployeeStaffResponseDto })
  updateEmployeePaymentInstructions(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateCustomerEmployeePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.access.updateEmployeePayment(employeeId, dto, user, {
      requiredCustomerId: id,
    });
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: 'List customers in organization' })
  @ApiOkResponse({ type: [CustomerResponseDto] })
  list(@CurrentUser() user: AuthUser) {
    const scoped = resolveCustomerScope(user);
    return this.service.list(user.organizationId, scoped);
  }
}
