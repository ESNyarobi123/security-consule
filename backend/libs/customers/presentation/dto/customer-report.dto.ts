import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/** Module 6-C — period query for customer report pack. */
export class CustomerReportQueryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Period start ISO (default: 30 days ago UTC midnight)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Period end ISO (default: now)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CustomerReportPeriodDto {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
}

export class CustomerReportSummaryDto {
  @ApiProperty() sites!: number;
  @ApiProperty() activeGuards!: number;
  @ApiProperty() incidentsOpened!: number;
  @ApiProperty() incidentsStillOpen!: number;
  @ApiProperty() attendanceClockIns!: number;
  @ApiProperty() accessEntries!: number;
  @ApiProperty() visitorAppointments!: number;
  @ApiProperty() visitorGateEntries!: number;
  @ApiProperty() parkingEntries!: number;
  @ApiProperty() complaintsOpened!: number;
  @ApiProperty() complaintsStillOpen!: number;
  @ApiProperty() serviceRequestsOpened!: number;
  @ApiProperty() invoicesIssued!: number;
  @ApiProperty() invoiceOutstandingAmount!: number;
  @ApiProperty() currency!: string;
}

export class CustomerEmployeeAttendanceReportDto {
  @ApiProperty() totalEmployees!: number;
  @ApiProperty() activeEmployees!: number;
  @ApiProperty() checkIns!: number;
  @ApiProperty() checkOuts!: number;
  @ApiProperty() uniqueEmployeesSeen!: number;
}

export class CustomerParkingReportDto {
  @ApiProperty() registeredVehicles!: number;
  @ApiProperty() activePermits!: number;
  @ApiProperty() pendingPermits!: number;
  @ApiProperty() entries!: number;
  @ApiProperty() exits!: number;
  @ApiProperty() deniedEntries!: number;
  @ApiProperty() violations!: number;
  @ApiProperty() blacklistedVehicles!: number;
}

export class CustomerPayrollReportDto {
  @ApiProperty() available!: boolean;
  @ApiProperty() cyclesInPeriod!: number;
  @ApiProperty() paidCycles!: number;
  @ApiProperty() pendingCycles!: number;
  @ApiProperty() payslipsInLatestCycle!: number;
  @ApiProperty() grossPayInLatestCycle!: number;
  @ApiProperty() netPayInLatestCycle!: number;
  @ApiPropertyOptional() latestCycleCode?: string | null;
  @ApiPropertyOptional() latestCycleStatus?: string | null;
  @ApiPropertyOptional() latestPeriodStart?: string | null;
  @ApiPropertyOptional() latestPeriodEnd?: string | null;
}

/** Portal 35.8 — live ops vs contract commitments (not percentile SLA). */
export class CustomerSlaPerformanceDto {
  @ApiProperty() activeContracts!: number;
  @ApiProperty() expiringContracts!: number;
  @ApiProperty() contractsWithSlaTerms!: number;
  @ApiProperty({ type: [String] }) slaLevels!: string[];
  @ApiProperty() committedGuards!: number;
  @ApiProperty() deployedGuards!: number;
  @ApiProperty() incidentsOpened!: number;
  @ApiProperty() incidentsStillOpen!: number;
  @ApiProperty() complaintsOpened!: number;
  @ApiProperty() complaintsStillOpen!: number;
  @ApiProperty() visitorGateEntries!: number;
  @ApiProperty() attendanceClockIns!: number;
}

export class CustomerReportSiteRowDto {
  @ApiProperty() siteId!: string;
  @ApiProperty() siteCode!: string;
  @ApiProperty() siteName!: string;
  @ApiProperty() incidentsOpened!: number;
  @ApiProperty() attendanceClockIns!: number;
  @ApiProperty() accessEntries!: number;
  @ApiProperty() visitorGateEntries!: number;
  @ApiProperty() parkingEntries!: number;
}

export class CustomerReportResponseDto {
  @ApiProperty() customerId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: CustomerReportPeriodDto })
  period!: CustomerReportPeriodDto;
  @ApiProperty({ type: CustomerReportSummaryDto })
  summary!: CustomerReportSummaryDto;
  @ApiProperty({ type: CustomerEmployeeAttendanceReportDto })
  customerEmployeeAttendance!: CustomerEmployeeAttendanceReportDto;
  @ApiProperty({ type: CustomerParkingReportDto })
  parkingReport!: CustomerParkingReportDto;
  @ApiProperty({ type: CustomerPayrollReportDto })
  payrollReport!: CustomerPayrollReportDto;
  @ApiProperty({ type: CustomerSlaPerformanceDto })
  slaPerformance!: CustomerSlaPerformanceDto;
  @ApiProperty({ type: [CustomerReportSiteRowDto] })
  bySite!: CustomerReportSiteRowDto[];
  @ApiProperty() generatedAt!: string;
  @ApiProperty({
    description: 'Honest notes — what is live vs deferred',
    type: [String],
  })
  notes!: string[];
}
