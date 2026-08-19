import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AccessEntryType,
  DeviceEventStatus,
  DeviceEventType,
  DeviceStatus,
  DeviceType,
  IncidentStatus,
  ParkingDecision,
  ParkingSpaceStatus,
  ParkingViolationStatus,
  VerificationResult,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { AuthUser, PrismaService } from '@pssms/shared';

const OPEN_VIOLATIONS: ParkingViolationStatus[] = [
  ParkingViolationStatus.OPEN,
  ParkingViolationStatus.CORRECTIVE_ACTION,
  ParkingViolationStatus.PENDING_CLOSURE,
];

const OPEN_INCIDENTS: IncidentStatus[] = [
  IncidentStatus.OPEN,
  IncidentStatus.INVESTIGATING,
];

const PARKING_ALARM_TYPES = [
  'PARKING_BLACKLISTED',
  'PARKING_UNAUTHORIZED',
  'PARKING_EXPIRED_PERMIT',
  'PARKING_FORCED_ENTRY',
  'PARKING_DUPLICATE_ENTRY',
  'PARKING_PATROL_OBSERVATION',
];

const MONITOR_NOTES = [
  'Video stays on the NVR — Nest returns camera metadata and AI/ANPR events only.',
  'CCTV Operator monitors parking, access, patrols, and incidents here without parking.manage / access.manage / incidents.manage.',
  'Supervisors stay Branch Ops. Authorized customer users stay customer-web (own data). ANPR decide stays Parking / Ops.',
];

@Injectable()
export class CctvMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertControlRoom(user: AuthUser) {
    if (user.customerId || user.supplierId) {
      throw new ForbiddenException({
        error: 'CCTV_STAFF_ONLY',
        message: 'CCTV monitoring is staff-only',
      });
    }
  }

  private sinceHours(hours: number) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }

  private async siteLabels(org: string, ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map<string, { code: string; name: string }>();
    const rows = await this.prisma.site.findMany({
      where: { organizationId: org, id: { in: unique } },
      select: { id: true, code: true, name: true },
    });
    return new Map(rows.map((s) => [s.id, { code: s.code, name: s.name }]));
  }

  private withSite<T extends { siteId: string | null }>(
    rows: T[],
    labels: Map<string, { code: string; name: string }>,
  ) {
    return rows.map((r) => {
      const site = r.siteId ? labels.get(r.siteId) : undefined;
      return {
        ...r,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
      };
    });
  }

  async reports(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const since24h = this.sinceHours(24);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      camerasTotal,
      camerasOnline,
      openAiAlerts,
      anprToday,
      parkingDenies24h,
      visitorDenies24h,
      openHighAlerts,
      openCctvIncidents,
    ] = await Promise.all([
      this.prisma.device.count({
        where: { organizationId: org, type: DeviceType.CCTV_CAMERA },
      }),
      this.prisma.device.count({
        where: {
          organizationId: org,
          type: DeviceType.CCTV_CAMERA,
          status: DeviceStatus.ONLINE,
        },
      }),
      this.prisma.deviceEvent.count({
        where: {
          organizationId: org,
          type: DeviceEventType.CCTV_EVENT,
          status: {
            in: [DeviceEventStatus.RECEIVED, DeviceEventStatus.FAILED],
          },
        },
      }),
      this.prisma.anprResult.count({
        where: { organizationId: org, capturedAt: { gte: startOfDay } },
      }),
      this.prisma.parkingEntry.count({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          decision: ParkingDecision.DENY,
        },
      }),
      this.prisma.visitorEntry.count({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          result: { not: VerificationResult.ALLOWED },
        },
      }),
      this.prisma.fieldAlert.count({
        where: {
          organizationId: org,
          acknowledged: false,
          severity: { in: ['HIGH', 'CRITICAL'] },
        },
      }),
      this.prisma.incident.count({
        where: {
          organizationId: org,
          category: 'CCTV_ALERT',
          status: { in: OPEN_INCIDENTS },
        },
      }),
    ]);

    const pack = {
      camerasTotal,
      camerasOnline,
      openAiAlerts,
      anprToday,
      parkingDenies24h,
      visitorDenies24h,
      openHighFieldAlerts: openHighAlerts,
      openCctvAlertIncidents: openCctvIncidents,
      generatedAt: new Date().toISOString(),
      notes: MONITOR_NOTES,
    };

    await this.audit.record({
      organizationId: org,
      actorId: user.id,
      action: 'cctv.reports.generated',
      resourceType: 'CctvReport',
      after: {
        camerasOnline,
        openAiAlerts,
        parkingDenies24h,
        openCctvIncidents,
      },
    });
    return pack;
  }

  async parkingMonitor(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const since24h = this.sinceHours(24);

    const [entries, violations, occupied, spacesActive, observations] =
      await Promise.all([
        this.prisma.parkingEntry.findMany({
          where: { organizationId: org, recordedAt: { gte: since24h } },
          orderBy: { recordedAt: 'desc' },
          take: 40,
          select: {
            id: true,
            siteId: true,
            plateNumber: true,
            direction: true,
            decision: true,
            recordedAt: true,
          },
        }),
        this.prisma.parkingViolation.findMany({
          where: { organizationId: org, status: { in: OPEN_VIOLATIONS } },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            siteId: true,
            plateNumber: true,
            violationType: true,
            status: true,
            createdAt: true,
          },
        }),
        this.prisma.parkingSpace.count({
          where: {
            organizationId: org,
            isActive: true,
            status: ParkingSpaceStatus.OCCUPIED,
          },
        }),
        this.prisma.parkingSpace.count({
          where: { organizationId: org, isActive: true },
        }),
        this.prisma.parkingPatrolObservation.findMany({
          where: { organizationId: org },
          orderBy: { inspectedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            siteId: true,
            parkingArea: true,
            observationType: true,
            plateNumber: true,
            inspectedAt: true,
          },
        }),
      ]);

    const labels = await this.siteLabels(org, [
      ...entries.map((e) => e.siteId),
      ...violations.map((v) => v.siteId),
      ...observations.map((o) => o.siteId),
    ]);

    return {
      occupancy: {
        occupied,
        spacesActive,
        utilizationPct:
          spacesActive > 0 ? Math.round((occupied / spacesActive) * 100) : null,
      },
      entries: this.withSite(entries, labels),
      openViolations: this.withSite(violations, labels),
      patrolObservations: this.withSite(observations, labels),
      notes: [
        'Read-only parking monitor. Issue/bill/approve stays parking-web (parking.manage).',
        ...MONITOR_NOTES,
      ],
    };
  }

  async accessMonitor(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const since24h = this.sinceHours(24);

    const [checkIns, checkOuts, accessRows, denies, denyRows] =
      await Promise.all([
        this.prisma.accessEntry.count({
          where: {
            organizationId: org,
            recordedAt: { gte: since24h },
            entryType: AccessEntryType.CHECK_IN,
          },
        }),
        this.prisma.accessEntry.count({
          where: {
            organizationId: org,
            recordedAt: { gte: since24h },
            entryType: AccessEntryType.CHECK_OUT,
          },
        }),
        this.prisma.accessEntry.findMany({
          where: { organizationId: org, recordedAt: { gte: since24h } },
          orderBy: { recordedAt: 'desc' },
          take: 40,
          select: {
            id: true,
            siteId: true,
            employeeId: true,
            entryType: true,
            accessMethod: true,
            recordedAt: true,
          },
        }),
        this.prisma.visitorEntry.count({
          where: {
            organizationId: org,
            recordedAt: { gte: since24h },
            result: { not: VerificationResult.ALLOWED },
          },
        }),
        this.prisma.visitorEntry.findMany({
          where: {
            organizationId: org,
            recordedAt: { gte: since24h },
            result: { not: VerificationResult.ALLOWED },
          },
          orderBy: { recordedAt: 'desc' },
          take: 30,
          select: {
            id: true,
            siteId: true,
            visitorName: true,
            result: true,
            denyReason: true,
            direction: true,
            recordedAt: true,
          },
        }),
      ]);

    const labels = await this.siteLabels(org, [
      ...accessRows.map((e) => e.siteId),
      ...denyRows.map((e) => e.siteId),
    ]);

    return {
      checkIns24h: checkIns,
      checkOuts24h: checkOuts,
      visitorDenies24h: denies,
      accessEntries: this.withSite(accessRows, labels),
      visitorDenies: this.withSite(denyRows, labels),
      notes: [
        'AccessEntry has no DENY column — gate denies are VisitorEntry. Customer employee punches stay access.*; guards stay attendance.*',
        ...MONITOR_NOTES,
      ],
    };
  }

  async patrolMonitor(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;

    const [scans, missed] = await Promise.all([
      this.prisma.patrolScan.findMany({
        where: { organizationId: org },
        orderBy: { scannedAt: 'desc' },
        take: 40,
        select: {
          id: true,
          siteId: true,
          guardId: true,
          checkpointId: true,
          method: true,
          scannedAt: true,
          remarks: true,
        },
      }),
      this.prisma.fieldAlert.findMany({
        where: {
          organizationId: org,
          alertType: 'PATROL_MISSED',
          acknowledged: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          siteId: true,
          alertType: true,
          severity: true,
          message: true,
          escalationStage: true,
          createdAt: true,
        },
      }),
    ]);

    const labels = await this.siteLabels(org, [
      ...scans.map((s) => s.siteId),
      ...missed.map((m) => m.siteId),
    ]);

    return {
      scans: this.withSite(scans, labels),
      missedPatrols: this.withSite(missed, labels),
      notes: [
        'Read-only. Mark-missed / route SLA stays Branch Ops (/branch/patrols).',
        ...MONITOR_NOTES,
      ],
    };
  }

  async alarmMonitor(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;

    const [field, failedCameras] = await Promise.all([
      this.prisma.fieldAlert.findMany({
        where: {
          organizationId: org,
          acknowledged: false,
          OR: [
            { severity: { in: ['HIGH', 'CRITICAL'] } },
            { alertType: 'GUARD_EMERGENCY' },
            { alertType: { in: PARKING_ALARM_TYPES } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          siteId: true,
          alertType: true,
          severity: true,
          message: true,
          escalationStage: true,
          createdAt: true,
        },
      }),
      this.prisma.deviceEvent.findMany({
        where: {
          organizationId: org,
          type: DeviceEventType.CCTV_EVENT,
          status: DeviceEventStatus.FAILED,
        },
        orderBy: { receivedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          deviceId: true,
          status: true,
          error: true,
          receivedAt: true,
        },
      }),
    ]);

    const labels = await this.siteLabels(
      org,
      field.map((f) => f.siteId),
    );

    return {
      fieldAlarms: this.withSite(field, labels),
      failedCameraEvents: failedCameras,
      notes: [
        'Alarms are FieldAlert + failed CCTV_EVENT rows — no parallel Alarm table.',
        'Ack / escalate FieldAlerts stays Branch Ops. AI inbox ack stays Alerts tab (28-A).',
        ...MONITOR_NOTES,
      ],
    };
  }

  async incidentMonitor(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const rows = await this.prisma.incident.findMany({
      where: {
        organizationId: org,
        status: { in: OPEN_INCIDENTS },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        siteId: true,
        incidentNumber: true,
        category: true,
        severity: true,
        status: true,
        title: true,
        occurredAt: true,
        createdAt: true,
      },
    });
    const labels = await this.siteLabels(
      org,
      rows.map((r) => r.siteId),
    );
    return {
      rows: this.withSite(rows, labels),
      notes: [
        'Read-only. Record from AI alert uses existing 28-A create-incident. Close stays Branch Ops.',
        ...MONITOR_NOTES,
      ],
    };
  }
}
