import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AlertnessStatus,
  DeploymentStatus,
  DeviceEventStatus,
  DeviceEventType,
  IncidentSeverity,
  IncidentStatus,
  VerificationResult,
  VisitorEntryDirection,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService, siteScopeWhere } from '@pssms/shared';
import { OperationsReportResponseDto } from '../presentation/dto/operations-report.dto';

const OPEN_INCIDENT: IncidentStatus[] = [
  IncidentStatus.OPEN,
  IncidentStatus.INVESTIGATING,
  IncidentStatus.RESOLVED,
];

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

function groupCount(
  rows: Array<{ key: string; count: number }>,
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) m[r.key] = r.count;
  return m;
}

/**
 * Module 34-A — Branch / Field Ops reports pack (live period counts + current backlog).
 * RBAC: operations.manage | attendance.manage | reporting.read; site ABAC via JWT.
 */
@Injectable()
export class OperationsReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async build(
    user: AuthUser,
    from?: string,
    to?: string,
    siteId?: string,
  ): Promise<OperationsReportResponseDto> {
    const period = this.resolvePeriod(from, to);
    const orgId = user.organizationId;
    const siteFilter = siteScopeWhere(user, siteId);
    const baseWhere = { organizationId: orgId, ...siteFilter };

    const sites = await this.prisma.site.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...siteFilter,
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });

    const siteIds = sites.map((s) => s.id);
    const siteIdIn =
      siteIds.length > 0 ? { siteId: { in: siteIds } } : { siteId: { in: [] } };

    const periodClockIn = {
      clockInAt: { gte: period.from, lte: period.to },
    };
    const periodClockOut = {
      clockOutAt: { gte: period.from, lte: period.to },
    };
    const periodScheduled = {
      scheduledAt: { gte: period.from, lte: period.to },
    };
    const periodCreated = {
      createdAt: { gte: period.from, lte: period.to },
    };
    const periodRecorded = {
      recordedAt: { gte: period.from, lte: period.to },
    };
    const periodOccurred = {
      occurredAt: { gte: period.from, lte: period.to },
    };
    const periodScanned = {
      scannedAt: { gte: period.from, lte: period.to },
    };
    const periodCaptured = {
      capturedAt: { gte: period.from, lte: period.to },
    };

    const geofenceWarning = {
      remarks: { contains: 'geofence', mode: 'insensitive' as const },
    };

    const [
      activeDeployments,
      openPunchesNow,
      clockInsInPeriod,
      clockOutsInPeriod,
      supervisorApprovedInPeriod,
      pendingApprovalNow,
      geofenceWarningsInPeriod,
      alertnessScheduled,
      alertnessConfirmed,
      alertnessLate,
      alertnessMissed,
      alertnessCancelled,
      alertnessByStatusRows,
      fieldAlertsRaised,
      fieldAlertsOpen,
      fieldAlertsAcked,
      fieldAlertTypeRows,
      fieldAlertStageRows,
      patrolScans,
      patrolIssues,
      patrolMissedAlerts,
      incidentsOpened,
      incidentsOpen,
      incidentsCriticalOpen,
      incidentSeverityRows,
      eobEntries,
      eobPending,
      visitorAppointments,
      visitorAllowed,
      visitorDenied,
      visitorExits,
      cctvOpen,
      cctvEvents,
      cctvTriaged,
    ] = await Promise.all([
      this.prisma.guardDeployment.count({
        where: {
          organizationId: orgId,
          status: DeploymentStatus.ACTIVE,
          ...siteIdIn,
        },
      }),
      this.prisma.guardAttendance.count({
        where: {
          organizationId: orgId,
          clockOutAt: null,
          ...siteIdIn,
        },
      }),
      this.prisma.guardAttendance.count({
        where: { ...baseWhere, ...periodClockIn },
      }),
      this.prisma.guardAttendance.count({
        where: { ...baseWhere, ...periodClockOut },
      }),
      this.prisma.guardAttendance.count({
        where: {
          ...baseWhere,
          ...periodClockIn,
          supervisorApproved: true,
        },
      }),
      this.prisma.guardAttendance.count({
        where: {
          organizationId: orgId,
          supervisorApproved: false,
          ...siteIdIn,
        },
      }),
      this.prisma.guardAttendance.count({
        where: {
          ...baseWhere,
          ...periodClockIn,
          ...geofenceWarning,
        },
      }),
      this.prisma.alertnessCheck.count({
        where: { ...baseWhere, ...periodScheduled },
      }),
      this.prisma.alertnessCheck.count({
        where: {
          ...baseWhere,
          ...periodScheduled,
          status: AlertnessStatus.CONFIRMED,
        },
      }),
      this.prisma.alertnessCheck.count({
        where: {
          ...baseWhere,
          ...periodScheduled,
          status: AlertnessStatus.LATE,
        },
      }),
      this.prisma.alertnessCheck.count({
        where: {
          ...baseWhere,
          ...periodScheduled,
          status: AlertnessStatus.MISSED,
        },
      }),
      this.prisma.alertnessCheck.count({
        where: {
          ...baseWhere,
          ...periodScheduled,
          status: AlertnessStatus.CANCELLED,
        },
      }),
      this.prisma.alertnessCheck.groupBy({
        by: ['status'],
        where: { ...baseWhere, ...periodScheduled },
        _count: { _all: true },
      }),
      this.prisma.fieldAlert.count({
        where: { ...baseWhere, ...periodCreated },
      }),
      this.prisma.fieldAlert.count({
        where: {
          organizationId: orgId,
          acknowledged: false,
          ...siteIdIn,
        },
      }),
      this.prisma.fieldAlert.count({
        where: {
          ...baseWhere,
          ...periodCreated,
          acknowledged: true,
        },
      }),
      this.prisma.fieldAlert.groupBy({
        by: ['alertType'],
        where: { ...baseWhere, ...periodCreated },
        _count: { _all: true },
      }),
      this.prisma.fieldAlert.groupBy({
        by: ['escalationStage'],
        where: { ...baseWhere, ...periodCreated },
        _count: { _all: true },
      }),
      this.prisma.patrolScan.count({
        where: { ...baseWhere, ...periodScanned },
      }),
      this.prisma.incident.count({
        where: {
          ...baseWhere,
          ...periodOccurred,
          category: 'PATROL_ISSUE',
        },
      }),
      this.prisma.fieldAlert.count({
        where: {
          ...baseWhere,
          ...periodCreated,
          alertType: 'PATROL_MISSED',
        },
      }),
      this.prisma.incident.count({
        where: { ...baseWhere, ...periodOccurred },
      }),
      this.prisma.incident.count({
        where: {
          organizationId: orgId,
          status: { in: OPEN_INCIDENT },
          ...siteIdIn,
        },
      }),
      this.prisma.incident.count({
        where: {
          organizationId: orgId,
          status: { in: OPEN_INCIDENT },
          severity: IncidentSeverity.CRITICAL,
          ...siteIdIn,
        },
      }),
      this.prisma.incident.groupBy({
        by: ['severity'],
        where: { ...baseWhere, ...periodOccurred },
        _count: { _all: true },
      }),
      this.prisma.occurrenceEntry.count({
        where: {
          ...baseWhere,
          ...periodRecorded,
          isCurrent: true,
        },
      }),
      this.prisma.occurrenceEntry.count({
        where: {
          organizationId: orgId,
          isCurrent: true,
          approvedBy: null,
          ...siteIdIn,
        },
      }),
      this.prisma.visitorAppointment.count({
        where: {
          organizationId: orgId,
          siteId: siteIds.length ? { in: siteIds } : { in: [] },
          createdAt: { gte: period.from, lte: period.to },
        },
      }),
      this.prisma.visitorEntry.count({
        where: {
          ...baseWhere,
          ...periodRecorded,
          result: VerificationResult.ALLOWED,
          direction: VisitorEntryDirection.IN,
        },
      }),
      this.prisma.visitorEntry.count({
        where: {
          ...baseWhere,
          ...periodRecorded,
          result: { not: VerificationResult.ALLOWED },
        },
      }),
      this.prisma.visitorEntry.count({
        where: {
          ...baseWhere,
          ...periodRecorded,
          direction: VisitorEntryDirection.OUT,
          result: VerificationResult.ALLOWED,
        },
      }),
      siteIds.length
        ? this.prisma.deviceEvent.count({
            where: {
              organizationId: orgId,
              type: DeviceEventType.CCTV_EVENT,
              status: DeviceEventStatus.RECEIVED,
              device: { siteId: { in: siteIds } },
            },
          })
        : Promise.resolve(0),
      siteIds.length
        ? this.prisma.deviceEvent.count({
            where: {
              organizationId: orgId,
              type: DeviceEventType.CCTV_EVENT,
              ...periodCaptured,
              device: { siteId: { in: siteIds } },
            },
          })
        : Promise.resolve(0),
      siteIds.length
        ? this.prisma.deviceEvent.count({
            where: {
              organizationId: orgId,
              type: DeviceEventType.CCTV_EVENT,
              status: DeviceEventStatus.PROCESSED,
              processedAt: { gte: period.from, lte: period.to },
              device: { siteId: { in: siteIds } },
            },
          })
        : Promise.resolve(0),
    ]);

    const alertnessByStatus = groupCount(
      alertnessByStatusRows.map((r) => ({
        key: r.status,
        count: r._count._all,
      })),
    );
    const completedAlertness =
      alertnessConfirmed + alertnessLate + alertnessMissed + alertnessCancelled;
    const confirmationRatePercent =
      completedAlertness > 0
        ? roundPct(
            ((alertnessConfirmed + alertnessLate) / completedAlertness) * 100,
          )
        : 0;

    const bySite: OperationsReportResponseDto['bySite'] = [];
    for (const site of sites) {
      const siteWhere = { siteId: site.id };
      const [
        clockIns,
        alertMissed,
        fieldAlerts,
        patrolScanCount,
        incidentsSite,
        eobSite,
        visitorDeniedSite,
      ] = await Promise.all([
        this.prisma.guardAttendance.count({
          where: {
            organizationId: orgId,
            ...siteWhere,
            ...periodClockIn,
          },
        }),
        this.prisma.alertnessCheck.count({
          where: {
            organizationId: orgId,
            ...siteWhere,
            ...periodScheduled,
            status: AlertnessStatus.MISSED,
          },
        }),
        this.prisma.fieldAlert.count({
          where: {
            organizationId: orgId,
            ...siteWhere,
            ...periodCreated,
          },
        }),
        this.prisma.patrolScan.count({
          where: {
            organizationId: orgId,
            ...siteWhere,
            ...periodScanned,
          },
        }),
        this.prisma.incident.count({
          where: {
            organizationId: orgId,
            ...siteWhere,
            ...periodOccurred,
          },
        }),
        this.prisma.occurrenceEntry.count({
          where: {
            organizationId: orgId,
            ...siteWhere,
            ...periodRecorded,
            isCurrent: true,
          },
        }),
        this.prisma.visitorEntry.count({
          where: {
            organizationId: orgId,
            ...siteWhere,
            ...periodRecorded,
            result: { not: VerificationResult.ALLOWED },
          },
        }),
      ]);
      bySite.push({
        siteId: site.id,
        siteCode: site.code,
        siteName: site.name,
        clockIns,
        alertnessMissed: alertMissed,
        fieldAlerts,
        patrolScans: patrolScanCount,
        incidentsOpened: incidentsSite,
        eobEntries: eobSite,
        visitorDenied: visitorDeniedSite,
      });
    }

    const report: OperationsReportResponseDto = {
      organizationId: orgId,
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
      },
      siteId: siteId ?? null,
      summary: {
        sitesInScope: sites.length,
        activeDeployments,
        openPunchesNow,
      },
      attendance: {
        clockInsInPeriod: clockInsInPeriod,
        clockOutsInPeriod: clockOutsInPeriod,
        supervisorApprovedInPeriod,
        pendingApprovalNow,
        geofenceWarningsInPeriod,
      },
      alertness: {
        scheduledInPeriod: alertnessScheduled,
        confirmed: alertnessConfirmed,
        late: alertnessLate,
        missed: alertnessMissed,
        cancelled: alertnessCancelled,
        confirmationRatePercent,
        byStatus: alertnessByStatus,
      },
      fieldAlerts: {
        raisedInPeriod: fieldAlertsRaised,
        openNow: fieldAlertsOpen,
        acknowledgedInPeriod: fieldAlertsAcked,
        byType: groupCount(
          fieldAlertTypeRows.map((r) => ({
            key: r.alertType,
            count: r._count._all,
          })),
        ),
        byEscalationStage: groupCount(
          fieldAlertStageRows.map((r) => ({
            key: r.escalationStage,
            count: r._count._all,
          })),
        ),
      },
      patrols: {
        scansInPeriod: patrolScans,
        patrolIssuesInPeriod: patrolIssues,
        patrolMissedAlertsInPeriod: patrolMissedAlerts,
      },
      incidents: {
        openedInPeriod: incidentsOpened,
        openNow: incidentsOpen,
        criticalOpenNow: incidentsCriticalOpen,
        bySeverity: groupCount(
          incidentSeverityRows.map((r) => ({
            key: r.severity,
            count: r._count._all,
          })),
        ),
      },
      eob: {
        entriesInPeriod: eobEntries,
        pendingApprovalNow: eobPending,
      },
      visitors: {
        appointmentsInPeriod: visitorAppointments,
        gateAllowed: visitorAllowed,
        gateDenied: visitorDenied,
        gateExits: visitorExits,
      },
      cctv: {
        openAlertsNow: cctvOpen,
        eventsInPeriod: cctvEvents,
        triagedInPeriod: cctvTriaged,
      },
      bySite,
      generatedAt: new Date().toISOString(),
      notes: [
        'Live period counts from operational tables — not executive KPI cache.',
        'openPunchesNow / fieldAlerts.openNow / incidents.openNow / cctv.openAlertsNow are current-state.',
        'Guard attendance only — customer employee access is separate (customer reports).',
        'Gate counts from visitor_entries — not parking ANPR.',
        'CCTV = device_events metadata only — no video through Nest.',
        'RBAC: operations.manage | attendance.manage | reporting.read; site ABAC enforced.',
        'Deferred: late/OT vs shift, PDF pack, charts, payroll/discipline hooks.',
      ],
    };

    await this.audit.record({
      organizationId: orgId,
      actorId: user.id,
      action: 'operations.reports.generated',
      resourceType: 'OperationsReport',
      resourceId: orgId,
      after: {
        from: report.period.from,
        to: report.period.to,
        siteId: siteId ?? null,
        sitesInScope: sites.length,
      },
    });

    return report;
  }

  private resolvePeriod(from?: string, to?: string): { from: Date; to: Date } {
    const end = to ? new Date(to) : new Date();
    const start = from
      ? new Date(from)
      : startOfUtcDay(new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException({
        error: 'INVALID_PERIOD',
        message: 'from/to must be valid dates',
      });
    }
    if (start > end) {
      throw new BadRequestException({
        error: 'INVALID_PERIOD',
        message: 'from must be before to',
      });
    }
    return { from: start, to: end };
  }
}
