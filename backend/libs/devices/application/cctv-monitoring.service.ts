import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
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
import { AuthUser, PrismaService, siteScopeWhere } from '@pssms/shared';
import {
  compareAlerts,
  deriveSeverityFromPayload,
  normaliseCctvAlert,
  type CctvAlertReview,
  type CctvIncidentLink,
} from './cctv-alert.util';

const OPEN_VIOLATIONS: ParkingViolationStatus[] = [
  ParkingViolationStatus.OPEN,
  ParkingViolationStatus.CORRECTIVE_ACTION,
  ParkingViolationStatus.PENDING_CLOSURE,
];

const OPEN_INCIDENTS: IncidentStatus[] = [
  IncidentStatus.OPEN,
  IncidentStatus.INVESTIGATING,
];

const OPEN_EVENT_STATUSES: DeviceEventStatus[] = [
  DeviceEventStatus.RECEIVED,
  DeviceEventStatus.FAILED,
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
  'CCTV Operator / Security Monitoring Officer monitor every area here without parking.manage / access.manage / incidents.manage.',
  'Supervisors are site-scoped (assigned sites only); Control Room, Operations Manager and CCTV Operator are org-wide.',
  'Authorized customer users stay customer-web (own data). ANPR decide stays Parking / Ops.',
];

type AlertFilters = {
  status?: string;
  siteId?: string;
  deviceId?: string;
  severity?: string;
  from?: string;
  to?: string;
  take?: string | number;
  q?: string;
};

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

  /** Site ACL for Device rows (supervisors see assigned sites only). */
  private deviceScope(user: AuthUser, requestedSiteId?: string) {
    return siteScopeWhere(user, requestedSiteId);
  }

  /** Site ACL for DeviceEvent rows — site lives on the related device. */
  private eventScope(user: AuthUser, requestedSiteId?: string) {
    const where = siteScopeWhere(user, requestedSiteId);
    return where.siteId ? { device: { siteId: where.siteId } } : {};
  }

  private async siteLabels(org: string, ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
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

  private take(value: string | number | undefined, fallback: number, max: number) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(Math.floor(n), max);
  }

  private parseDate(value: string | undefined, label: string): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException({
        error: 'INVALID_PERIOD',
        message: `${label} is not a valid date`,
      });
    }
    return d;
  }

  // ── AI alerts ─────────────────────────────────────────────────

  /**
   * Rich AI alert inbox: raw CCTV_EVENT metadata joined with camera + site,
   * normalised detection/severity/confidence/snapshot, and the incident that
   * was recorded from it (28-A link) so the operator sees the whole chain.
   */
  async alerts(user: AuthUser, filters: AlertFilters = {}) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const take = this.take(filters.take, 60, 200);
    const from = this.parseDate(filters.from, 'from');
    const to = this.parseDate(filters.to, 'to');
    const scope = this.eventScope(user, filters.siteId);

    const status = filters.status?.trim().toUpperCase();
    const statusWhere =
      status === 'OPEN'
        ? { status: { in: OPEN_EVENT_STATUSES } }
        : status === 'CLOSED' || status === 'TRIAGED'
          ? { status: { in: [DeviceEventStatus.PROCESSED, DeviceEventStatus.IGNORED] } }
          : status && status !== 'ALL'
            ? { status: status as DeviceEventStatus }
            : {};

    const baseWhere = {
      organizationId: org,
      type: DeviceEventType.CCTV_EVENT,
      ...scope,
      ...(filters.deviceId ? { deviceId: filters.deviceId } : {}),
      ...(from || to
        ? { capturedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };

    const [rows, openRows, triaged24h] = await Promise.all([
      this.prisma.deviceEvent.findMany({
        where: { ...baseWhere, ...statusWhere },
        orderBy: { capturedAt: 'desc' },
        take,
        include: {
          device: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              status: true,
              vendor: true,
              model: true,
              siteId: true,
              gateId: true,
              lastSeenAt: true,
              config: true,
            },
          },
        },
      }),
      this.prisma.deviceEvent.findMany({
        where: { ...baseWhere, status: { in: OPEN_EVENT_STATUSES } },
        orderBy: { capturedAt: 'desc' },
        take: 200,
        include: {
          device: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              status: true,
              vendor: true,
              model: true,
              siteId: true,
              gateId: true,
              lastSeenAt: true,
              config: true,
            },
          },
        },
      }),
      this.prisma.deviceEvent.count({
        where: {
          ...baseWhere,
          status: DeviceEventStatus.PROCESSED,
          routedTo: 'acknowledged',
          processedAt: { gte: this.sinceHours(24) },
        },
      }),
    ]);

    const labels = await this.siteLabels(
      org,
      rows.map((r) => r.device?.siteId),
    );

    const incidentLinks = await this.incidentLinks(
      org,
      rows.filter((r) => r.routedTo === 'incidents').map((r) => r.id),
    );

    const reviewLinks = await this.reviewLinks(
      org,
      [...new Set([...rows, ...openRows].map((r) => r.id))],
    );

    const normalised = rows.map((row) =>
      normaliseCctvAlert(
        row,
        row.device?.siteId ? labels.get(row.device.siteId) : undefined,
        incidentLinks.get(row.id) ?? null,
        reviewLinks.get(row.id) ?? null,
      ),
    );

    const severityFilter = filters.severity?.trim().toUpperCase();
    const query = filters.q?.trim().toLowerCase();
    const filtered = normalised
      .filter((a) =>
        severityFilter ? a.severity === severityFilter : true,
      )
      .filter((a) => {
        if (!query) return true;
        return [
          a.title,
          a.summary,
          a.detectionType,
          a.camera?.code,
          a.camera?.name,
          a.siteCode,
          a.siteName,
          a.plateNumber,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query));
      })
      .sort(compareAlerts);

    const openViews = openRows.map((row) =>
      normaliseCctvAlert(
        row,
        row.device?.siteId ? labels.get(row.device.siteId) : undefined,
        incidentLinks.get(row.id) ?? null,
        reviewLinks.get(row.id) ?? null,
      ),
    );

    const counts = {
      open: openRows.length,
      critical: openViews.filter((a) => a.severity === 'CRITICAL').length,
      high: openViews.filter((a) => a.severity === 'HIGH').length,
      medium: openViews.filter((a) => a.severity === 'MEDIUM').length,
      low: openViews.filter((a) => a.severity === 'LOW').length,
      acknowledged24h: triaged24h,
      incidentsRecorded: normalised.filter((a) => a.incident != null).length,
    };

    return {
      rows: filtered,
      counts,
      filters: {
        status: status ?? 'ALL',
        severity: severityFilter ?? null,
        siteId: filters.siteId ?? null,
        deviceId: filters.deviceId ?? null,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
        take,
      },
      notes: [
        'Every row is one append-only CCTV_EVENT. Severity/confidence/zone/snapshot are normalised from the vendor payload; the raw payload is kept for audit.',
        'Acknowledge = reviewed (metadata only). Record incident = creates a CCTV_ALERT incident at the camera site, linked back to this alert.',
        ...MONITOR_NOTES,
      ],
    };
  }

  /** Map deviceEvent id → incident recorded from it (`clientEventId = device-event:{id}`). */
  private async incidentLinks(
    org: string,
    eventIds: string[],
  ): Promise<Map<string, CctvIncidentLink>> {
    const map = new Map<string, CctvIncidentLink>();
    if (!eventIds.length) return map;
    const rows = await this.prisma.incident.findMany({
      where: {
        organizationId: org,
        clientEventId: { in: eventIds.map((id) => `device-event:${id}`) },
      },
      select: {
        id: true,
        incidentNumber: true,
        status: true,
        severity: true,
        clientEventId: true,
      },
    });
    for (const row of rows) {
      const key = row.clientEventId?.replace(/^device-event:/, '');
      if (!key) continue;
      map.set(key, {
        id: row.id,
        incidentNumber: row.incidentNumber,
        status: row.status,
        severity: row.severity,
      });
    }
    return map;
  }

  /**
   * Who reviewed / recorded an incident from each alert, read from the audit
   * trail so the inbox can show the officer, time and note instead of only a
   * status code.
   */
  private async reviewLinks(
    org: string,
    eventIds: string[],
  ): Promise<Map<string, CctvAlertReview>> {
    const map = new Map<string, CctvAlertReview>();
    if (!eventIds.length) return map;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        organizationId: org,
        resourceType: 'DeviceEvent',
        resourceId: { in: eventIds },
        action: {
          in: ['cctv.event.acknowledged', 'cctv.event.incident_created'],
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        action: true,
        resourceId: true,
        actorId: true,
        createdAt: true,
        after: true,
      },
    });
    if (!rows.length) return map;
    const actorIds = [
      ...new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id))),
    ];
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds }, organizationId: org },
          select: { id: true, fullName: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.fullName]));

    for (const row of rows) {
      if (!row.resourceId) continue;
      const current =
        map.get(row.resourceId) ??
        ({
          acknowledgedByName: null,
          acknowledgedAt: null,
          note: null,
          incidentByName: null,
          incidentAt: null,
        } satisfies CctvAlertReview);
      const actor = row.actorId ? names.get(row.actorId) ?? 'Unknown officer' : null;
      const after =
        row.after && typeof row.after === 'object' && !Array.isArray(row.after)
          ? (row.after as Record<string, unknown>)
          : {};
      if (row.action === 'cctv.event.acknowledged') {
        current.acknowledgedByName = actor;
        current.acknowledgedAt = row.createdAt.toISOString();
        current.note =
          typeof after.note === 'string' && after.note.trim()
            ? after.note.trim()
            : null;
      } else {
        current.incidentByName = actor;
        current.incidentAt = row.createdAt.toISOString();
      }
      map.set(row.resourceId, current);
    }
    return map;
  }

  // ── Control-room overview ──────────────────────────────────────

  /**
   * One call for the wall: counts + latest samples for every area the portal
   * is required to monitor (CCTV, AI alerts, parking, access, patrols,
   * alarms, incidents). Site-scoped for supervisors.
   */
  async overview(user: AuthUser, args: { siteId?: string } = {}) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const since24h = this.sinceHours(24);
    const requestedSiteId = args.siteId?.trim() || undefined;
    // One scope object drives every area so the wall can be focused on a site
    // while supervisors still cannot escape their granted sites.
    const siteScope = siteScopeWhere(user, requestedSiteId);
    const deviceWhere = this.deviceScope(user, requestedSiteId);
    const eventWhere = this.eventScope(user, requestedSiteId);
    const accessWhere = siteScope;
    const patrolWhere = siteScope;
    const alertWhere = siteScope;
    const incidentWhere = siteScope;

    const openAiAlerts = await this.prisma.deviceEvent.findMany({
      where: {
        organizationId: org,
        type: DeviceEventType.CCTV_EVENT,
        status: { in: OPEN_EVENT_STATUSES },
        ...eventWhere,
      },
      orderBy: { capturedAt: 'desc' },
      take: 200,
      include: {
        device: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            status: true,
            vendor: true,
            model: true,
            siteId: true,
            gateId: true,
            lastSeenAt: true,
            config: true,
          },
        },
      },
    });

    const [
      camerasTotal,
      camerasOnline,
      anprToday,
      recentAnpr,
      parkingDenies24h,
      parkingEntries24h,
      recentEntries,
      openViolations,
      occupiedSpaces,
      activeSpaces,
      checkIns24h,
      checkOuts24h,
      visitorDenies24h,
      recentAccess,
      recentDenies,
      patrolScans24h,
      recentScans,
      missedPatrols,
      openHighAlerts,
      recentFieldAlerts,
      failedCameraEvents,
      openIncidents,
      criticalIncidents,
      recentIncidents,
    ] = await Promise.all([
      this.prisma.device.count({
        where: {
          organizationId: org,
          type: DeviceType.CCTV_CAMERA,
          ...deviceWhere,
        },
      }),
      this.prisma.device.count({
        where: {
          organizationId: org,
          type: DeviceType.CCTV_CAMERA,
          status: DeviceStatus.ONLINE,
          ...deviceWhere,
        },
      }),
      this.prisma.anprResult.count({
        where: {
          organizationId: org,
          capturedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          ...siteScope,
        },
      }),
      this.prisma.anprResult.findMany({
        where: { organizationId: org, ...siteScope },
        orderBy: { capturedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          siteId: true,
          plateNumber: true,
          confidence: true,
          decision: true,
          capturedAt: true,
        },
      }),
      this.prisma.parkingEntry.count({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          decision: ParkingDecision.DENY,
          ...siteScope,
        },
      }),
      this.prisma.parkingEntry.count({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          ...siteScope,
        },
      }),
      this.prisma.parkingEntry.findMany({
        where: { organizationId: org, ...siteScope },
        orderBy: { recordedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          siteId: true,
          plateNumber: true,
          direction: true,
          decision: true,
          recordedAt: true,
        },
      }),
      this.prisma.parkingViolation.count({
        where: {
          organizationId: org,
          status: { in: OPEN_VIOLATIONS },
          ...siteScope,
        },
      }),
      this.prisma.parkingSpace.count({
        where: {
          organizationId: org,
          isActive: true,
          status: ParkingSpaceStatus.OCCUPIED,
          ...siteScope,
        },
      }),
      this.prisma.parkingSpace.count({
        where: {
          organizationId: org,
          isActive: true,
          ...siteScope,
        },
      }),
      this.prisma.accessEntry.count({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          entryType: AccessEntryType.CHECK_IN,
          ...accessWhere,
        },
      }),
      this.prisma.accessEntry.count({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          entryType: AccessEntryType.CHECK_OUT,
          ...accessWhere,
        },
      }),
      this.prisma.visitorEntry.count({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          result: { not: VerificationResult.ALLOWED },
          ...siteScope,
        },
      }),
      this.prisma.accessEntry.findMany({
        where: { organizationId: org, ...accessWhere },
        orderBy: { recordedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          siteId: true,
          employeeId: true,
          entryType: true,
          accessMethod: true,
          recordedAt: true,
        },
      }),
      this.prisma.visitorEntry.findMany({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          result: { not: VerificationResult.ALLOWED },
          ...siteScope,
        },
        orderBy: { recordedAt: 'desc' },
        take: 6,
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
      this.prisma.patrolScan.count({
        where: {
          organizationId: org,
          scannedAt: { gte: since24h },
          ...patrolWhere,
        },
      }),
      this.prisma.patrolScan.findMany({
        where: { organizationId: org, ...patrolWhere },
        orderBy: { scannedAt: 'desc' },
        take: 6,
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
      this.prisma.fieldAlert.count({
        where: {
          organizationId: org,
          alertType: 'PATROL_MISSED',
          acknowledged: false,
          ...alertWhere,
        },
      }),
      this.prisma.fieldAlert.count({
        where: {
          organizationId: org,
          acknowledged: false,
          severity: { in: ['HIGH', 'CRITICAL'] },
          ...alertWhere,
        },
      }),
      this.prisma.fieldAlert.findMany({
        where: {
          organizationId: org,
          acknowledged: false,
          ...alertWhere,
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
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
      this.prisma.deviceEvent.count({
        where: {
          organizationId: org,
          type: DeviceEventType.CCTV_EVENT,
          status: DeviceEventStatus.FAILED,
          ...eventWhere,
        },
      }),
      this.prisma.incident.count({
        where: {
          organizationId: org,
          status: { in: OPEN_INCIDENTS },
          ...incidentWhere,
        },
      }),
      this.prisma.incident.count({
        where: {
          organizationId: org,
          status: { in: OPEN_INCIDENTS },
          severity: 'CRITICAL',
          ...incidentWhere,
        },
      }),
      this.prisma.incident.findMany({
        where: {
          organizationId: org,
          status: { in: OPEN_INCIDENTS },
          ...incidentWhere,
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
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
      }),
    ]);

    const labels = await this.siteLabels(org, [
      ...recentAnpr.map((r) => r.siteId),
      ...recentEntries.map((r) => r.siteId),
      ...recentAccess.map((r) => r.siteId),
      ...recentDenies.map((r) => r.siteId),
      ...recentScans.map((r) => r.siteId),
      ...recentFieldAlerts.map((r) => r.siteId),
      ...recentIncidents.map((r) => r.siteId),
      ...openAiAlerts.map((r) => r.device?.siteId),
    ]);

    const alerts = openAiAlerts
      .map((row) =>
        normaliseCctvAlert(
          row,
          row.device?.siteId ? labels.get(row.device.siteId) : undefined,
          null,
        ),
      )
      .sort(compareAlerts);

    const [accessEnriched, scansEnriched] = await Promise.all([
      this.enrichAccess(recentAccess, org),
      this.enrichPatrolScans(recentScans, org),
    ]);

    const severityCounts = {
      critical: alerts.filter((a) => a.severity === 'CRITICAL').length,
      high: alerts.filter((a) => a.severity === 'HIGH').length,
      medium: alerts.filter((a) => a.severity === 'MEDIUM').length,
      low: alerts.filter((a) => a.severity === 'LOW').length,
    };

    const openAlarmCount = await this.prisma.fieldAlert.count({
      where: {
        organizationId: org,
        acknowledged: false,
        OR: [
          { severity: { in: ['HIGH', 'CRITICAL'] } },
          { alertType: 'GUARD_EMERGENCY' },
          { alertType: { in: PARKING_ALARM_TYPES } },
        ],
        ...alertWhere,
      },
    });

    const siteFocus = requestedSiteId
      ? (await this.siteLabels(org, [requestedSiteId])).get(requestedSiteId) ??
        null
      : null;

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        siteId: requestedSiteId ?? null,
        siteCode: siteFocus?.code ?? null,
        siteName: siteFocus?.name ?? null,
      },
      cameras: {
        total: camerasTotal,
        online: camerasOnline,
        offline: Math.max(0, camerasTotal - camerasOnline),
      },
      aiAlerts: {
        open: alerts.length,
        ...severityCounts,
        latest: alerts.slice(0, 8),
      },
      parking: {
        entries24h: parkingEntries24h,
        denies24h: parkingDenies24h,
        openViolations,
        occupiedSpaces,
        activeSpaces,
        utilizationPct:
          activeSpaces > 0
            ? Math.round((occupiedSpaces / activeSpaces) * 100)
            : null,
        anprToday,
        latestAnpr: this.withSite(recentAnpr, labels),
        latestEntries: this.withSite(recentEntries, labels),
      },
      access: {
        checkIns24h,
        checkOuts24h,
        visitorDenies24h,
        latest: this.withSite(accessEnriched, labels),
        latestDenies: this.withSite(recentDenies, labels),
      },
      patrols: {
        scans24h: patrolScans24h,
        missedOpen: missedPatrols,
        latest: this.withSite(scansEnriched, labels),
      },
      alarms: {
        openHigh: openHighAlerts,
        openTotal: openAlarmCount,
        failedCameraEvents,
        latest: this.withSite(recentFieldAlerts, labels),
      },
      incidents: {
        open: openIncidents,
        critical: criticalIncidents,
        latest: this.withSite(recentIncidents, labels),
      },
      notes: MONITOR_NOTES,
    };
  }

  // ── Area monitors (read-only) ──────────────────────────────────

  async reports(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const since24h = this.sinceHours(24);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const siteWhere = siteScopeWhere(user);

    const [
      camerasTotal,
      camerasOnline,
      openAiAlerts,
      criticalAiAlerts,
      anprToday,
      parkingDenies24h,
      visitorDenies24h,
      openHighAlerts,
      openCctvIncidents,
      missedPatrols,
    ] = await Promise.all([
      this.prisma.device.count({
        where: { organizationId: org, type: DeviceType.CCTV_CAMERA, ...siteWhere },
      }),
      this.prisma.device.count({
        where: {
          organizationId: org,
          type: DeviceType.CCTV_CAMERA,
          status: DeviceStatus.ONLINE,
          ...siteWhere,
        },
      }),
      this.prisma.deviceEvent.count({
        where: {
          organizationId: org,
          type: DeviceEventType.CCTV_EVENT,
          status: { in: OPEN_EVENT_STATUSES },
          ...this.eventScope(user),
        },
      }),
      this.openCriticalAlerts(user),
      this.prisma.anprResult.count({
        where: { organizationId: org, capturedAt: { gte: startOfDay }, ...siteWhere },
      }),
      this.prisma.parkingEntry.count({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          decision: ParkingDecision.DENY,
          ...siteWhere,
        },
      }),
      this.prisma.visitorEntry.count({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          result: { not: VerificationResult.ALLOWED },
          ...siteWhere,
        },
      }),
      this.prisma.fieldAlert.count({
        where: {
          organizationId: org,
          acknowledged: false,
          severity: { in: ['HIGH', 'CRITICAL'] },
          ...siteWhere,
        },
      }),
      this.prisma.incident.count({
        where: {
          organizationId: org,
          category: 'CCTV_ALERT',
          status: { in: OPEN_INCIDENTS },
          ...siteWhere,
        },
      }),
      this.prisma.fieldAlert.count({
        where: {
          organizationId: org,
          alertType: 'PATROL_MISSED',
          acknowledged: false,
          ...siteWhere,
        },
      }),
    ]);

    const pack = {
      camerasTotal,
      camerasOnline,
      openAiAlerts,
      criticalAiAlerts,
      anprToday,
      parkingDenies24h,
      visitorDenies24h,
      openHighFieldAlerts: openHighAlerts,
      openCctvAlertIncidents: openCctvIncidents,
      missedPatrols,
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

  private async openCriticalAlerts(user: AuthUser): Promise<number> {
    const rows = await this.prisma.deviceEvent.findMany({
      where: {
        organizationId: user.organizationId,
        type: DeviceEventType.CCTV_EVENT,
        status: { in: OPEN_EVENT_STATUSES },
        ...this.eventScope(user),
      },
      select: { id: true, payload: true },
      take: 500,
    });
    return rows.filter((row) => {
      const payload =
        row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};
      return deriveSeverityFromPayload(payload) === 'CRITICAL';
    }).length;
  }

  private async enrichAccess<T extends { employeeId: string }>(
    rows: T[],
    org: string,
  ): Promise<
    Array<
      T & {
        employeeName: string | null;
        employeeNumber: string | null;
        customerId: string | null;
      }
    >
  > {
    const ids = [...new Set(rows.map((r) => r.employeeId))];
    const employees = ids.length
      ? await this.prisma.customerEmployee.findMany({
          where: { organizationId: org, id: { in: ids } },
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            customerId: true,
          },
        })
      : [];
    const map = new Map(employees.map((e) => [e.id, e]));
    return rows.map((r) => {
      const e = map.get(r.employeeId);
      return {
        ...r,
        employeeName: e?.fullName ?? null,
        employeeNumber: e?.employeeNumber ?? null,
        customerId: e?.customerId ?? null,
      };
    });
  }

  private async enrichPatrolScans<
    T extends { guardId: string; checkpointId: string },
  >(rows: T[], org: string) {
    const guardIds = [...new Set(rows.map((r) => r.guardId))];
    const checkpointIds = [...new Set(rows.map((r) => r.checkpointId))];
    const [guards, checkpoints] = await Promise.all([
      guardIds.length
        ? this.prisma.guardProfile.findMany({
            where: { organizationId: org, id: { in: guardIds } },
            select: {
              id: true,
              employeeNumber: true,
              employee: { select: { fullName: true } },
            },
          })
        : Promise.resolve([]),
      checkpointIds.length
        ? this.prisma.checkpoint.findMany({
            where: { organizationId: org, id: { in: checkpointIds } },
            select: { id: true, code: true, name: true, zone: true },
          })
        : Promise.resolve([]),
    ]);
    const guardMap = new Map(guards.map((g) => [g.id, g]));
    const cpMap = new Map(checkpoints.map((c) => [c.id, c]));
    return rows.map((r) => {
      const g = guardMap.get(r.guardId);
      const cp = cpMap.get(r.checkpointId);
      return {
        ...r,
        guardName: g?.employee?.fullName ?? null,
        employeeNumber: g?.employeeNumber ?? null,
        checkpointCode: cp?.code ?? null,
        checkpointName: cp?.name ?? null,
        checkpointZone: cp?.zone ?? null,
      };
    });
  }

  async parkingMonitor(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const since24h = this.sinceHours(24);
    const siteWhere = siteScopeWhere(user);

    const [entries, violations, occupied, spacesActive, observations] =
      await Promise.all([
        this.prisma.parkingEntry.findMany({
          where: { organizationId: org, recordedAt: { gte: since24h }, ...siteWhere },
          orderBy: { recordedAt: 'desc' },
          take: 40,
          select: {
            id: true,
            siteId: true,
            plateNumber: true,
            direction: true,
            decision: true,
            recordedAt: true,
            gateId: true,
            driverName: true,
            verificationMethod: true,
            purposeOfVisit: true,
          },
        }),
        this.prisma.parkingViolation.findMany({
          where: { organizationId: org, status: { in: OPEN_VIOLATIONS }, ...siteWhere },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            siteId: true,
            plateNumber: true,
            violationType: true,
            status: true,
            createdAt: true,
            description: true,
            officerRemarks: true,
          },
        }),
        this.prisma.parkingSpace.count({
          where: {
            organizationId: org,
            isActive: true,
            status: ParkingSpaceStatus.OCCUPIED,
            ...siteWhere,
          },
        }),
        this.prisma.parkingSpace.count({
          where: { organizationId: org, isActive: true, ...siteWhere },
        }),
        this.prisma.parkingPatrolObservation.findMany({
          where: { organizationId: org, ...siteWhere },
          orderBy: { inspectedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            siteId: true,
            parkingArea: true,
            observationType: true,
            severity: true,
            plateNumber: true,
            notes: true,
            inspectedAt: true,
          },
        }),
      ]);

    const labels = await this.siteLabels(org, [
      ...entries.map((e) => e.siteId),
      ...violations.map((v) => v.siteId),
      ...observations.map((o) => o.siteId),
    ]);
    const gateLabels = await this.gateLabels(
      org,
      entries.map((e) => e.gateId),
    );

    return {
      occupancy: {
        occupied,
        spacesActive,
        utilizationPct:
          spacesActive > 0 ? Math.round((occupied / spacesActive) * 100) : null,
      },
      entries: this.withSite(
        entries.map((e) => ({
          ...e,
          gateCode: e.gateId ? gateLabels.get(e.gateId)?.code ?? null : null,
          gateName: e.gateId ? gateLabels.get(e.gateId)?.name ?? null : null,
        })),
        labels,
      ),
      openViolations: this.withSite(violations, labels),
      patrolObservations: this.withSite(observations, labels),
      notes: [
        'Read-only parking monitor. Issue/bill/approve stays parking-web (parking.manage).',
        ...MONITOR_NOTES,
      ],
    };
  }

  private async gateLabels(
    org: string,
    ids: Array<string | null | undefined>,
  ) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map<string, { code: string; name: string }>();
    const rows = await this.prisma.gate.findMany({
      where: { organizationId: org, id: { in: unique } },
      select: { id: true, code: true, name: true },
    });
    return new Map(rows.map((g) => [g.id, { code: g.code, name: g.name }]));
  }

  /** Visitor denies are more useful with the appointment + host context. */
  private async appointmentLabels(
    org: string,
    ids: Array<string | null | undefined>,
  ) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) {
      return new Map<
        string,
        { referenceNumber: string; visitorPhone: string | null; hostName: string | null }
      >();
    }
    const rows = await this.prisma.visitorAppointment.findMany({
      where: { organizationId: org, id: { in: unique } },
      select: {
        id: true,
        referenceNumber: true,
        visitorPhone: true,
        hostName: true,
      },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        {
          referenceNumber: r.referenceNumber,
          visitorPhone: r.visitorPhone,
          hostName: r.hostName,
        },
      ]),
    );
  }

  async accessMonitor(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const since24h = this.sinceHours(24);
    const siteWhere = siteScopeWhere(user);

    const [checkIns, checkOuts, accessRows, denies, denyRows] =
      await Promise.all([
        this.prisma.accessEntry.count({
          where: {
            organizationId: org,
            recordedAt: { gte: since24h },
            entryType: AccessEntryType.CHECK_IN,
            ...siteWhere,
          },
        }),
        this.prisma.accessEntry.count({
          where: {
            organizationId: org,
            recordedAt: { gte: since24h },
            entryType: AccessEntryType.CHECK_OUT,
            ...siteWhere,
          },
        }),
        this.prisma.accessEntry.findMany({
          where: { organizationId: org, recordedAt: { gte: since24h }, ...siteWhere },
          orderBy: { recordedAt: 'desc' },
          take: 40,
          select: {
            id: true,
            siteId: true,
            employeeId: true,
            entryType: true,
            accessMethod: true,
            gateId: true,
            recordedAt: true,
          },
        }),
        this.prisma.visitorEntry.count({
          where: {
            organizationId: org,
            recordedAt: { gte: since24h },
            result: { not: VerificationResult.ALLOWED },
            ...siteWhere,
          },
        }),
        this.prisma.visitorEntry.findMany({
          where: {
            organizationId: org,
            recordedAt: { gte: since24h },
            result: { not: VerificationResult.ALLOWED },
            ...siteWhere,
          },
          orderBy: { recordedAt: 'desc' },
          take: 30,
          select: {
            id: true,
            siteId: true,
            gateId: true,
            appointmentId: true,
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
    const enriched = await this.enrichAccess(accessRows, org);
    const gateLabels = await this.gateLabels(org, [
      ...accessRows.map((e) => e.gateId),
      ...denyRows.map((e) => e.gateId),
    ]);
    const appointments = await this.appointmentLabels(
      org,
      denyRows.map((e) => e.appointmentId),
    );

    return {
      checkIns24h: checkIns,
      checkOuts24h: checkOuts,
      visitorDenies24h: denies,
      accessEntries: this.withSite(
        enriched.map((e) => ({
          ...e,
          gateCode: e.gateId ? gateLabels.get(e.gateId)?.code ?? null : null,
          gateName: e.gateId ? gateLabels.get(e.gateId)?.name ?? null : null,
        })),
        labels,
      ),
      visitorDenies: this.withSite(
        denyRows.map((e) => ({
          ...e,
          gateCode: e.gateId ? gateLabels.get(e.gateId)?.code ?? null : null,
          gateName: e.gateId ? gateLabels.get(e.gateId)?.name ?? null : null,
          referenceNumber: e.appointmentId
            ? appointments.get(e.appointmentId)?.referenceNumber ?? null
            : null,
          visitorPhone: e.appointmentId
            ? appointments.get(e.appointmentId)?.visitorPhone ?? null
            : null,
          hostName: e.appointmentId
            ? appointments.get(e.appointmentId)?.hostName ?? null
            : null,
        })),
        labels,
      ),
      notes: [
        'AccessEntry has no DENY column — gate denies are VisitorEntry. Customer employee punches stay access.*; guards stay attendance.*',
        ...MONITOR_NOTES,
      ],
    };
  }

  async patrolMonitor(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const siteWhere = siteScopeWhere(user);

    const [scans, missed] = await Promise.all([
      this.prisma.patrolScan.findMany({
        where: { organizationId: org, ...siteWhere },
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
          ...siteWhere,
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
    const enriched = await this.enrichPatrolScans(scans, org);

    return {
      scans: this.withSite(enriched, labels),
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
    const siteWhere = siteScopeWhere(user);

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
          ...siteWhere,
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
          guardId: true,
          acknowledged: true,
        },
      }),
      this.prisma.deviceEvent.findMany({
        where: {
          organizationId: org,
          type: DeviceEventType.CCTV_EVENT,
          status: DeviceEventStatus.FAILED,
          ...this.eventScope(user),
        },
        orderBy: { receivedAt: 'desc' },
        take: 20,
        include: {
          device: {
            select: {
              id: true,
              code: true,
              name: true,
              siteId: true,
              status: true,
              lastSeenAt: true,
            },
          },
        },
      }),
    ]);

    const labels = await this.siteLabels(org, [
      ...field.map((f) => f.siteId),
      ...failedCameras.map((f) => f.device?.siteId),
    ]);
    const guardLabels = await this.guardLabels(
      org,
      field.map((f) => f.guardId),
    );

    return {
      fieldAlarms: this.withSite(
        field.map((f) => ({
          ...f,
          guardName: f.guardId ? guardLabels.get(f.guardId)?.fullName ?? null : null,
          employeeNumber: f.guardId
            ? guardLabels.get(f.guardId)?.employeeNumber ?? null
            : null,
        })),
        labels,
      ),
      failedCameraEvents: failedCameras.map((row) => ({
        id: row.id,
        deviceId: row.deviceId,
        cameraCode: row.device?.code ?? null,
        cameraName: row.device?.name ?? null,
        cameraStatus: row.device?.status ?? null,
        cameraLastSeenAt: row.device?.lastSeenAt?.toISOString() ?? null,
        siteCode: row.device?.siteId ? labels.get(row.device.siteId)?.code ?? null : null,
        siteName: row.device?.siteId ? labels.get(row.device.siteId)?.name ?? null : null,
        status: row.status,
        error: row.error,
        capturedAt: row.capturedAt,
        receivedAt: row.receivedAt,
      })),
      notes: [
        'Alarms are FieldAlert + failed CCTV_EVENT rows — no parallel Alarm table.',
        'Ack / escalate FieldAlerts stays Branch Ops. AI inbox ack stays Alerts tab (28-A).',
        ...MONITOR_NOTES,
      ],
    };
  }

  private async guardLabels(
    org: string,
    ids: Array<string | null | undefined>,
  ) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) {
      return new Map<string, { fullName: string | null; employeeNumber: string | null }>();
    }
    const rows = await this.prisma.guardProfile.findMany({
      where: { organizationId: org, id: { in: unique } },
      select: {
        id: true,
        employeeNumber: true,
        employee: { select: { fullName: true } },
      },
    });
    return new Map(
      rows.map((g) => [
        g.id,
        {
          fullName: g.employee?.fullName ?? null,
          employeeNumber: g.employeeNumber,
        },
      ]),
    );
  }

  async incidentMonitor(user: AuthUser) {
    this.assertControlRoom(user);
    const org = user.organizationId;
    const rows = await this.prisma.incident.findMany({
      where: {
        organizationId: org,
        status: { in: OPEN_INCIDENTS },
        ...siteScopeWhere(user),
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
        clientEventId: true,
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
