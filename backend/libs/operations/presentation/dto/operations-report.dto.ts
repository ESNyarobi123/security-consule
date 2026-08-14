import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class OperationsReportQueryDto {
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

export class OperationsReportPeriodDto {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;
}

export class OperationsReportSummaryDto {
  @ApiProperty()
  sitesInScope!: number;

  @ApiProperty()
  activeDeployments!: number;

  @ApiProperty({ description: 'Open guard punches (clockOutAt null)' })
  openPunchesNow!: number;
}

export class OperationsReportAttendanceDto {
  @ApiProperty()
  clockInsInPeriod!: number;

  @ApiProperty()
  clockOutsInPeriod!: number;

  @ApiProperty()
  supervisorApprovedInPeriod!: number;

  @ApiProperty()
  pendingApprovalNow!: number;

  @ApiProperty()
  geofenceWarningsInPeriod!: number;
}

export class OperationsReportAlertnessDto {
  @ApiProperty()
  scheduledInPeriod!: number;

  @ApiProperty()
  confirmed!: number;

  @ApiProperty()
  late!: number;

  @ApiProperty()
  missed!: number;

  @ApiProperty()
  cancelled!: number;

  @ApiProperty({ description: '(confirmed+late)/(completed)×100' })
  confirmationRatePercent!: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  byStatus!: Record<string, number>;
}

export class OperationsReportFieldAlertsDto {
  @ApiProperty()
  raisedInPeriod!: number;

  @ApiProperty()
  openNow!: number;

  @ApiProperty()
  acknowledgedInPeriod!: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  byType!: Record<string, number>;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  byEscalationStage!: Record<string, number>;
}

export class OperationsReportPatrolsDto {
  @ApiProperty()
  scansInPeriod!: number;

  @ApiProperty()
  patrolIssuesInPeriod!: number;

  @ApiProperty()
  patrolMissedAlertsInPeriod!: number;
}

export class OperationsReportIncidentsDto {
  @ApiProperty()
  openedInPeriod!: number;

  @ApiProperty()
  openNow!: number;

  @ApiProperty()
  criticalOpenNow!: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  bySeverity!: Record<string, number>;
}

export class OperationsReportEobDto {
  @ApiProperty()
  entriesInPeriod!: number;

  @ApiProperty()
  pendingApprovalNow!: number;
}

export class OperationsReportVisitorsDto {
  @ApiProperty()
  appointmentsInPeriod!: number;

  @ApiProperty()
  gateAllowed!: number;

  @ApiProperty()
  gateDenied!: number;

  @ApiProperty()
  gateExits!: number;
}

export class OperationsReportCctvDto {
  @ApiProperty({ description: 'CCTV_EVENT with status RECEIVED (current backlog)' })
  openAlertsNow!: number;

  @ApiProperty()
  eventsInPeriod!: number;

  @ApiProperty()
  triagedInPeriod!: number;
}

export class OperationsReportBySiteRowDto {
  @ApiProperty()
  siteId!: string;

  @ApiProperty()
  siteCode!: string;

  @ApiProperty()
  siteName!: string;

  @ApiProperty()
  clockIns!: number;

  @ApiProperty()
  alertnessMissed!: number;

  @ApiProperty()
  fieldAlerts!: number;

  @ApiProperty()
  patrolScans!: number;

  @ApiProperty()
  incidentsOpened!: number;

  @ApiProperty()
  eobEntries!: number;

  @ApiProperty()
  visitorDenied!: number;
}

export class OperationsReportResponseDto {
  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ type: OperationsReportPeriodDto })
  period!: OperationsReportPeriodDto;

  @ApiPropertyOptional({ nullable: true })
  siteId?: string | null;

  @ApiProperty({ type: OperationsReportSummaryDto })
  summary!: OperationsReportSummaryDto;

  @ApiProperty({ type: OperationsReportAttendanceDto })
  attendance!: OperationsReportAttendanceDto;

  @ApiProperty({ type: OperationsReportAlertnessDto })
  alertness!: OperationsReportAlertnessDto;

  @ApiProperty({ type: OperationsReportFieldAlertsDto })
  fieldAlerts!: OperationsReportFieldAlertsDto;

  @ApiProperty({ type: OperationsReportPatrolsDto })
  patrols!: OperationsReportPatrolsDto;

  @ApiProperty({ type: OperationsReportIncidentsDto })
  incidents!: OperationsReportIncidentsDto;

  @ApiProperty({ type: OperationsReportEobDto })
  eob!: OperationsReportEobDto;

  @ApiProperty({ type: OperationsReportVisitorsDto })
  visitors!: OperationsReportVisitorsDto;

  @ApiProperty({ type: OperationsReportCctvDto })
  cctv!: OperationsReportCctvDto;

  @ApiProperty({ type: [OperationsReportBySiteRowDto] })
  bySite!: OperationsReportBySiteRowDto[];

  @ApiProperty()
  generatedAt!: string;

  @ApiProperty({ type: [String] })
  notes!: string[];
}
