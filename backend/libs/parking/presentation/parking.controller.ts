import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ParkingDecision, PermitStatus } from '@prisma/client';
import { AuthUser, CurrentUser, resolveCustomerScope } from '@pssms/shared';
import { ParkingService } from '../application/parking.service';
import {
  AnprResultResponseDto,
  CreateAnprResultDto,
  CreateParkingEntryDto,
  CreateParkingPermitDto,
  CreateParkingViolationDto,
  CreateVehicleBlacklistDto,
  CreateVehicleDto,
  DecideAnprResultDto,
  ParkingEntryResponseDto,
  ParkingPermitResponseDto,
  ParkingViolationResponseDto,
  UpdatePermitStatusDto,
  VehicleBlacklistResponseDto,
  VehicleResponseDto,
} from './dto/parking.dto';

@ApiTags('Parking')
@ApiBearerAuth()
@Controller('parking')
export class ParkingController {
  constructor(private readonly service: ParkingService) {}

  @Post('vehicles')
  @ApiOperation({ summary: 'Register vehicle' })
  @ApiCreatedResponse({ type: VehicleResponseDto })
  createVehicle(@Body() dto: CreateVehicleDto, @CurrentUser() user: AuthUser) {
    return this.service.createVehicle(dto, user);
  }

  @Get('vehicles')
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

  @Post('permits')
  @ApiOperation({ summary: 'Issue parking permit (starts PENDING)' })
  @ApiCreatedResponse({ type: ParkingPermitResponseDto })
  createPermit(
    @Body() dto: CreateParkingPermitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createPermit(dto, user);
  }

  @Get('permits')
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

  @Post('permits/:id/approve')
  @ApiOperation({ summary: 'Approve pending permit (SoD)' })
  @ApiOkResponse({ type: ParkingPermitResponseDto })
  approvePermit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approvePermit(id, user);
  }

  @Post('permits/:id/reject')
  @ApiOperation({ summary: 'Reject pending permit (SoD → REVOKED)' })
  @ApiOkResponse({ type: ParkingPermitResponseDto })
  rejectPermit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.rejectPermit(id, user);
  }

  @Patch('permits/:id/status')
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
  @ApiOperation({ summary: 'List ANPR results' })
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
  @ApiOperation({ summary: 'Allow/deny ANPR result and record entry/violation' })
  @ApiOkResponse({ type: AnprResultResponseDto })
  decideAnpr(
    @Param('id') id: string,
    @Body() dto: DecideAnprResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.decideAnprResult(id, dto, user);
  }

  @Post('entries')
  @ApiOperation({ summary: 'Record parking entry/exit (manual gate)' })
  @ApiCreatedResponse({ type: ParkingEntryResponseDto })
  recordEntry(
    @Body() dto: CreateParkingEntryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordEntry(dto, user);
  }

  @Get('entries')
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
  @ApiOperation({ summary: 'Record parking violation' })
  @ApiCreatedResponse({ type: ParkingViolationResponseDto })
  createViolation(
    @Body() dto: CreateParkingViolationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createViolation(dto, user);
  }

  @Get('violations')
  @ApiOperation({ summary: 'List parking violations' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiOkResponse({ type: [ParkingViolationResponseDto] })
  listViolations(
    @CurrentUser() user: AuthUser,
    @Query('siteId') siteId?: string,
  ) {
    return this.service.listViolations(user, siteId);
  }

  @Get('blacklist')
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
  @ApiOperation({ summary: 'Add plate to blacklist' })
  @ApiCreatedResponse({ type: VehicleBlacklistResponseDto })
  addBlacklist(
    @Body() dto: CreateVehicleBlacklistDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addBlacklist(dto, user);
  }

  @Patch('blacklist/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate blacklist entry' })
  @ApiOkResponse({ type: VehicleBlacklistResponseDto })
  deactivateBlacklist(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.deactivateBlacklist(id, user);
  }
}
