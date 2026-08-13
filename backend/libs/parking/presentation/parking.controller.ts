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
import { ParkingDecision, ParkingViolationStatus, PermitStatus, ParkingSpaceType, ParkingSpaceStatus, ParkingPatrolObservationType } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
  PermissionsGuard,
  RequireAnyPermissions,
  RequirePermissions,
  resolveCustomerScope,
} from '@pssms/shared';
import { ParkingService } from '../application/parking.service';
import {
  AllocateParkingSpaceDto,
  AnprResultResponseDto,
  ApproveParkingViolationClosureDto,
  CreateAnprResultDto,
  CreateParkingEntryDto,
  CreateParkingPermitDto,
  CreateParkingPatrolObservationDto,
  CreateParkingSpaceDto,
  CreateParkingViolationDto,
  CreateVehicleBlacklistDto,
  CreateVehicleDto,
  DecideAnprResultDto,
  ParkingCustomerOptionDto,
  ParkingEntryResponseDto,
  ParkingPermitResponseDto,
  ParkingPatrolObservationResponseDto,
  ParkingSiteOptionDto,
  ParkingSpaceResponseDto,
  ParkingViolationResponseDto,
  ParkingVisitorAppointmentOptionDto,
  ResolveParkingViolationDto,
  UpdateParkingPermitDto,
  UpdateParkingSpaceDto,
  UpdateParkingViolationDto,
  UpdatePermitStatusDto,
  UpdateVehicleDto,
  VehicleBlacklistResponseDto,
  VehicleResponseDto,
} from './dto/parking.dto';
import {
  ParkingReportQueryDto,
  ParkingReportResponseDto,
} from './dto/parking-report.dto';
import { ParkingReportsService } from '../application/parking-reports.service';

@ApiTags('Parking')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('parking')
export class ParkingController {
  constructor(
    private readonly service: ParkingService,
    private readonly reports: ParkingReportsService,
  ) {}

  @Get('me')
  @RequirePermissions('parking.self')
  @ApiOperation({
    summary: 'Own vehicles summary (approved owner/driver · E3)',
  })
  me(@CurrentUser() user: AuthUser) {
    return this.service.getOwnerMe(user);
  }

  @Get('me/permits')
  @RequirePermissions('parking.self')
  @ApiOperation({ summary: 'Own vehicle permits (E3)' })
  @ApiOkResponse({ type: [ParkingPermitResponseDto] })
  myPermits(@CurrentUser() user: AuthUser) {
    return this.service.listOwnerPermits(user);
  }

  @Get('me/entries')
  @RequirePermissions('parking.self')
  @ApiOperation({ summary: 'Own vehicle gate entries (E3)' })
  @ApiOkResponse({ type: [ParkingEntryResponseDto] })
  myEntries(@CurrentUser() user: AuthUser) {
    return this.service.listOwnerEntries(user);
  }

  @Post('vehicles')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Register vehicle (ops · Modules 13-E / 13-I; portal 13-C forced CUSTOMER)',
  })
  @ApiCreatedResponse({ type: VehicleResponseDto })
  createVehicle(@Body() dto: CreateVehicleDto, @CurrentUser() user: AuthUser) {
    return this.service.createVehicle(dto, user);
  }

  @Get('vehicles')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'List vehicles' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiOkResponse({ type: [VehicleResponseDto] })
  listVehicles(
    @CurrentUser() user: AuthUser,
    @Query('customerId') customerId?: string,
  ) {
    const scoped = resolveCustomerScope(user, customerId);
    return this.service.listVehicles(user, scoped);
  }

  @Patch('vehicles/:id')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Update vehicle (RFID + profile + category + driver + active · Modules 13-A / 13-E / 13-I)',
  })
  @ApiOkResponse({ type: VehicleResponseDto })
  updateVehicle(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateVehicle(id, dto, user);
  }

  @Get('customer-options')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Thin customer picker for vehicle register (id/code/name · Module 13-E)',
  })
  @ApiOkResponse({ type: [ParkingCustomerOptionDto] })
  listCustomerOptions(@CurrentUser() user: AuthUser) {
    return this.service.listCustomerOptions(user);
  }

  @Get('site-options')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Thin site + gates picker for manual gate punch (Module 13-F)',
  })
  @ApiOkResponse({ type: [ParkingSiteOptionDto] })
  listSiteOptions(@CurrentUser() user: AuthUser) {
    return this.service.listSiteOptions(user);
  }

  @Get('visitor-appointment-options')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Thin APPROVED/COMPLETED appointments for permit link (Module 13-H)',
  })
  @ApiOkResponse({ type: [ParkingVisitorAppointmentOptionDto] })
  listVisitorAppointmentOptions(@CurrentUser() user: AuthUser) {
    return this.service.listVisitorAppointmentOptions(user);
  }

  @Post('permits')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'Issue parking permit (starts PENDING)' })
  @ApiCreatedResponse({ type: ParkingPermitResponseDto })
  createPermit(
    @Body() dto: CreateParkingPermitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createPermit(dto, user);
  }

  @Get('permits')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'List parking permits' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PermitStatus })
  @ApiOkResponse({ type: [ParkingPermitResponseDto] })
  listPermits(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: PermitStatus,
  ) {
    const scoped = resolveCustomerScope(user, customerId);
    return this.service.listPermits(user, siteId, scoped, status);
  }

  @Patch('permits/:id')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary: 'Update permit fee / currency (Module 13-B · not auto-bill)',
  })
  @ApiOkResponse({ type: ParkingPermitResponseDto })
  updatePermit(
    @Param('id') id: string,
    @Body() dto: UpdateParkingPermitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updatePermit(id, dto, user);
  }

  @Post('permits/:id/approve')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'Approve pending permit (SoD · does not bill)' })
  @ApiOkResponse({ type: ParkingPermitResponseDto })
  approvePermit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approvePermit(id, user);
  }

  @Post('permits/:id/reject')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'Reject pending permit (SoD → REVOKED)' })
  @ApiOkResponse({ type: ParkingPermitResponseDto })
  rejectPermit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.rejectPermit(id, user);
  }

  @Post('permits/:id/bill')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Create parking invoice for calculated permit charges (Module 13-O · optional send)',
  })
  @ApiQuery({
    name: 'send',
    required: false,
    description: 'If true, send DRAFT invoice immediately (electronic invoicing)',
  })
  @ApiOkResponse({ type: ParkingPermitResponseDto })
  billPermit(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('send') send?: string,
  ) {
    const sendInvoice = send === 'true' || send === '1';
    return this.service.billPermit(id, user, { sendInvoice });
  }

  @Patch('permits/:id/status')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary: 'Update permit status (REVOKED/SUSPENDED/ACTIVE ops)',
  })
  @ApiOkResponse({ type: ParkingPermitResponseDto })
  updatePermitStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePermitStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updatePermitStatus(id, dto, user);
  }

  @Post('anpr-results')
  @RequireAnyPermissions('parking.manage', 'operations.manage', 'cctv.manage')
  @ApiOperation({
    summary: 'Ingest ANPR metadata (from vision-ai-service / integration)',
  })
  @ApiCreatedResponse({ type: AnprResultResponseDto })
  ingestAnpr(
    @Body() dto: CreateAnprResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.ingestAnprResult(dto, user);
  }

  @Get('anpr-results')
  @RequireAnyPermissions(
    'parking.manage',
    'cctv.manage',
    'operations.manage',
  )
  @ApiOperation({
    summary: 'List ANPR results (parking / CCTV mosaic / ops)',
  })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'decision', required: false, enum: ParkingDecision })
  @ApiOkResponse({ type: [AnprResultResponseDto] })
  listAnpr(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
    @Query('decision') decision?: ParkingDecision,
  ) {
    return this.service.listAnprResults(user, siteId, decision);
  }

  @Patch('anpr-results/:id/decide')
  @RequireAnyPermissions('parking.manage', 'operations.manage')
  @ApiOperation({
    summary: 'Allow/deny ANPR result (parking/ops — not CCTV-only)',
  })
  @ApiOkResponse({ type: AnprResultResponseDto })
  decideAnpr(
    @Param('id') id: string,
    @Body() dto: DecideAnprResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.decideAnprResult(id, dto, user);
  }

  @Post('entries')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Record parking entry/exit (Modules 13-F/K/L · visit record + FieldAlerts)',
  })
  @ApiCreatedResponse({ type: ParkingEntryResponseDto })
  recordEntry(
    @Body() dto: CreateParkingEntryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordEntry(dto, user);
  }

  @Get('entries')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'List parking entries' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: [ParkingEntryResponseDto] })
  listEntries(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
  ) {
    return this.service.listEntries(user, siteId);
  }

  @Post('violations')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'Record parking violation (Module 13-G · OPEN)' })
  @ApiCreatedResponse({ type: ParkingViolationResponseDto })
  createViolation(
    @Body() dto: CreateParkingViolationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createViolation(dto, user);
  }

  @Get('violations')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'List parking violations' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ParkingViolationStatus })
  @ApiOkResponse({ type: [ParkingViolationResponseDto] })
  listViolations(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
    @Query('status') status?: ParkingViolationStatus,
  ) {
    return this.service.listViolations(user, siteId, status);
  }

  @Post('violations/:id/resolve')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Approve closure (Module 13-N · alias when PENDING_CLOSURE; creator ≠ approver)',
  })
  @ApiOkResponse({ type: ParkingViolationResponseDto })
  resolveViolation(
    @Param('id') id: string,
    @Body() dto: ResolveParkingViolationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.resolveViolation(id, dto, user);
  }

  @Patch('violations/:id')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Update officer remarks / corrective action (Module 13-N · OPEN/CORRECTIVE_ACTION)',
  })
  @ApiOkResponse({ type: ParkingViolationResponseDto })
  updateViolation(
    @Param('id') id: string,
    @Body() dto: UpdateParkingViolationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateViolation(id, dto, user);
  }

  @Post('violations/:id/submit-closure')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Submit violation for closure approval (Module 13-N · requires corrective action)',
  })
  @ApiOkResponse({ type: ParkingViolationResponseDto })
  submitViolationClosure(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.submitViolationClosure(id, user);
  }

  @Post('violations/:id/approve-closure')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Approve and close violation (Module 13-N · submitter ≠ approver, creator ≠ approver)',
  })
  @ApiOkResponse({ type: ParkingViolationResponseDto })
  approveViolationClosure(
    @Param('id') id: string,
    @Body() dto: ApproveParkingViolationClosureDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.approveViolationClosure(id, dto, user);
  }

  @Post('violations/:id/bill')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Create finance invoice for violation fine (Module 13-P · optional send)',
  })
  @ApiQuery({
    name: 'send',
    required: false,
    description: 'If true, send DRAFT invoice immediately',
  })
  @ApiOkResponse({ type: ParkingViolationResponseDto })
  billViolation(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('send') send?: string,
  ) {
    return this.service.billViolation(id, user, {
      sendInvoice: send === 'true' || send === '1',
    });
  }

  @Get('blacklist')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'List vehicle blacklist' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiOkResponse({ type: [VehicleBlacklistResponseDto] })
  listBlacklist(
    @CurrentUser() user: AuthUser,
    @Query('active') active?: string,
  ) {
    const activeFilter =
      active === undefined
        ? undefined
        : active === 'true' || active === '1'
          ? true
          : active === 'false' || active === '0'
            ? false
            : undefined;
    return this.service.listBlacklist(user, activeFilter);
  }

  @Post('blacklist')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'Add plate to blacklist' })
  @ApiCreatedResponse({ type: VehicleBlacklistResponseDto })
  addBlacklist(
    @Body() dto: CreateVehicleBlacklistDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addBlacklist(dto, user);
  }

  @Patch('blacklist/:id/deactivate')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'Deactivate blacklist entry' })
  @ApiOkResponse({ type: VehicleBlacklistResponseDto })
  deactivateBlacklist(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.deactivateBlacklist(id, user);
  }

  // ── Module 13-J — spaces + allocation ─────────────────────────────────

  @Post('spaces')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary: 'Register parking space / bay (Module 13-J)',
  })
  @ApiCreatedResponse({ type: ParkingSpaceResponseDto })
  createParkingSpace(
    @Body() dto: CreateParkingSpaceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createParkingSpace(dto, user);
  }

  @Get('spaces')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'List parking spaces (Module 13-J)' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'spaceType', required: false, enum: ParkingSpaceType })
  @ApiQuery({ name: 'status', required: false, enum: ParkingSpaceStatus })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiOkResponse({ type: [ParkingSpaceResponseDto] })
  listParkingSpaces(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
    @Query('spaceType') spaceType?: ParkingSpaceType,
    @Query('status') status?: ParkingSpaceStatus,
    @Query('customerId') customerId?: string,
  ) {
    return this.service.listParkingSpaces(user, {
      siteId,
      spaceType,
      status,
      customerId,
    });
  }

  @Patch('spaces/:id')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'Update parking space metadata (Module 13-J)' })
  @ApiOkResponse({ type: ParkingSpaceResponseDto })
  updateParkingSpace(
    @Param('id') id: string,
    @Body() dto: UpdateParkingSpaceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateParkingSpace(id, dto, user);
  }

  @Post('spaces/allocate')
  @RequirePermissions('parking.manage')
  @ApiOperation({
    summary:
      'Allocate bay to vehicle — MANUAL (spaceId) or AUTO (policy · Module 13-J)',
  })
  @ApiCreatedResponse({ type: ParkingSpaceResponseDto })
  allocateParkingSpace(
    @Body() dto: AllocateParkingSpaceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.allocateParkingSpace(dto, user);
  }

  @Post('spaces/:id/release')
  @RequirePermissions('parking.manage')
  @ApiOperation({ summary: 'Release occupied parking space (Module 13-J)' })
  @ApiOkResponse({ type: ParkingSpaceResponseDto })
  releaseParkingSpace(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.releaseParkingSpace(id, user);
  }

  // ── Module 13-M — parking patrol observations ─────────────────────────

  @Post('patrol-observations')
  @RequireAnyPermissions('attendance.manage', 'parking.manage')
  @ApiOperation({
    summary:
      'Record parking patrol observation (guard mobile · Module 13-M)',
  })
  @ApiCreatedResponse({ type: ParkingPatrolObservationResponseDto })
  createParkingPatrolObservation(
    @Body() dto: CreateParkingPatrolObservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createParkingPatrolObservation(dto, user);
  }

  @Get('patrol-observations')
  @RequireAnyPermissions(
    'attendance.manage',
    'parking.manage',
    'operations.manage',
  )
  @ApiOperation({ summary: 'List parking patrol observations (Module 13-M)' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({
    name: 'observationType',
    required: false,
    enum: ParkingPatrolObservationType,
  })
  @ApiQuery({ name: 'guardId', required: false })
  @ApiOkResponse({ type: [ParkingPatrolObservationResponseDto] })
  listParkingPatrolObservations(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
    @Query('observationType') observationType?: ParkingPatrolObservationType,
    @Query('guardId') guardId?: string,
  ) {
    return this.service.listParkingPatrolObservations(user, {
      siteId,
      observationType,
      guardId,
    });
  }

  @Get('reports')
  @RequireAnyPermissions('parking.manage', 'reporting.read')
  @ApiOperation({
    summary:
      'Parking reports pack (Module 13-Q · entries, occupancy, violations, revenue, patrols)',
  })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: ParkingReportResponseDto })
  getParkingReports(
    @CurrentUser() user: AuthUser,
    @Query() query: ParkingReportQueryDto,
  ) {
    return this.reports.build(
      user,
      query.from,
      query.to,
      query.siteId,
    );
  }
}
