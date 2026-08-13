import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ParkingReportQueryDto {
  @ApiPropertyOptional({ description: 'ISO date — default 30d before to' })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — default now' })
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ description: 'Optional site filter (ABAC-scoped)' })
  @IsOptional()
  @IsUUID()
  siteId?: string;
}

export class ParkingReportPeriodDto {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;
}

export class ParkingReportEntriesExitsDto {
  @ApiProperty()
  entries!: number;

  @ApiProperty()
  exits!: number;

  @ApiProperty()
  allowed!: number;

  @ApiProperty()
  denied!: number;

  @ApiProperty({ description: 'ENTRY ALLOW without paired EXIT (current)' })
  openVisits!: number;
}

export class ParkingReportOccupancyDto {
  @ApiProperty()
  totalSpaces!: number;

  @ApiProperty()
  available!: number;

  @ApiProperty()
  occupied!: number;

  @ApiProperty()
  reserved!: number;

  @ApiProperty()
  outOfService!: number;

  @ApiProperty({ description: 'occupied / (total - outOfService) × 100' })
  utilizationPercent!: number;
}

export class ParkingReportVisitorParkingDto {
  @ApiProperty()
  activeVisitorPermits!: number;

  @ApiProperty()
  visitorPermitsIssuedInPeriod!: number;

  @ApiProperty()
  visitorEntries!: number;

  @ApiProperty()
  activeContractorPermits!: number;
}

export class ParkingReportEmployeeParkingDto {
  @ApiProperty()
  activeEmployeePermits!: number;

  @ApiProperty()
  employeePermitsIssuedInPeriod!: number;

  @ApiProperty()
  customerEmployeeVehicles!: number;

  @ApiProperty()
  fleetVehicles!: number;
}

export class ParkingReportViolationsDto {
  @ApiProperty()
  recordedInPeriod!: number;

  @ApiProperty()
  openNow!: number;

  @ApiProperty()
  closedInPeriod!: number;

  @ApiProperty({ type: Object })
  byType!: Record<string, number>;

  @ApiProperty()
  finesBilledInPeriod!: number;

  @ApiProperty()
  finesRevenueBilled!: number;
}

export class ParkingReportBlacklistDto {
  @ApiProperty()
  activePlates!: number;

  @ApiProperty()
  addedInPeriod!: number;
}

export class ParkingReportPatrolsDto {
  @ApiProperty()
  observationsInPeriod!: number;

  @ApiProperty()
  highSeverity!: number;

  @ApiProperty()
  accidents!: number;

  @ApiProperty()
  suspiciousActivity!: number;

  @ApiProperty()
  illegalParking!: number;

  @ApiProperty({ type: Object })
  byType!: Record<string, number>;
}

export class ParkingReportRevenueDto {
  @ApiProperty()
  currency!: string;

  @ApiProperty()
  permitInvoicesBilledInPeriod!: number;

  @ApiProperty()
  permitRevenueBilled!: number;

  @ApiProperty()
  violationInvoicesBilledInPeriod!: number;

  @ApiProperty()
  violationRevenueBilled!: number;

  @ApiProperty()
  totalBilledInPeriod!: number;
}

export class ParkingReportSecurityIncidentsDto {
  @ApiProperty({
    description: 'Incidents at sites with parking spaces in period',
  })
  incidentsInPeriod!: number;

  @ApiProperty()
  incidentsOpenNow!: number;

  @ApiProperty()
  patrolAccidentsInPeriod!: number;

  @ApiProperty()
  patrolSuspiciousInPeriod!: number;
}

export class ParkingReportSiteRowDto {
  @ApiProperty()
  siteId!: string;

  @ApiProperty()
  siteCode!: string;

  @ApiProperty()
  siteName!: string;

  @ApiProperty()
  entries!: number;

  @ApiProperty()
  exits!: number;

  @ApiProperty()
  denied!: number;

  @ApiProperty()
  activePermits!: number;

  @ApiProperty()
  violations!: number;

  @ApiProperty()
  spacesTotal!: number;

  @ApiProperty()
  spacesOccupied!: number;

  @ApiProperty()
  utilizationPercent!: number;
}

export class ParkingReportSummaryDto {
  @ApiProperty()
  sitesInScope!: number;

  @ApiProperty()
  registeredVehicles!: number;

  @ApiProperty()
  activePermits!: number;

  @ApiProperty()
  pendingPermits!: number;
}

export class ParkingReportResponseDto {
  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ type: ParkingReportPeriodDto })
  period!: ParkingReportPeriodDto;

  @ApiPropertyOptional()
  siteId?: string | null;

  @ApiProperty({ type: ParkingReportSummaryDto })
  summary!: ParkingReportSummaryDto;

  @ApiProperty({ type: ParkingReportEntriesExitsDto })
  entriesExits!: ParkingReportEntriesExitsDto;

  @ApiProperty({ type: ParkingReportOccupancyDto })
  occupancy!: ParkingReportOccupancyDto;

  @ApiProperty({ type: ParkingReportVisitorParkingDto })
  visitorParking!: ParkingReportVisitorParkingDto;

  @ApiProperty({ type: ParkingReportEmployeeParkingDto })
  employeeParking!: ParkingReportEmployeeParkingDto;

  @ApiProperty({ type: ParkingReportViolationsDto })
  violations!: ParkingReportViolationsDto;

  @ApiProperty({ type: ParkingReportBlacklistDto })
  blacklist!: ParkingReportBlacklistDto;

  @ApiProperty({ type: ParkingReportPatrolsDto })
  patrols!: ParkingReportPatrolsDto;

  @ApiProperty({ type: ParkingReportRevenueDto })
  revenue!: ParkingReportRevenueDto;

  @ApiProperty({ type: ParkingReportSecurityIncidentsDto })
  securityIncidents!: ParkingReportSecurityIncidentsDto;

  @ApiProperty({ type: [ParkingReportSiteRowDto] })
  bySite!: ParkingReportSiteRowDto[];

  @ApiProperty()
  generatedAt!: string;

  @ApiProperty({ type: [String] })
  notes!: string[];
}
