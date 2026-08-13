import { BadRequestException, Injectable } from '@nestjs/common';
import {
  IncidentStatus,
  ParkingCategory,
  ParkingDecision,
  ParkingEntryDirection,
  ParkingPatrolObservationType,
  ParkingSpaceStatus,
  ParkingViolationStatus,
  PermitStatus,
  PermitType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import {
  AuthUser,
  PrismaService,
  siteScopeWhere,
} from '@pssms/shared';
import {
  ParkingReportResponseDto,
} from '../presentation/dto/parking-report.dto';

const OPEN_INCIDENT: IncidentStatus[] = [
  IncidentStatus.OPEN,
  IncidentStatus.INVESTIGATING,
  IncidentStatus.RESOLVED,
];

const OPEN_VIOLATION: ParkingViolationStatus[] = [
  ParkingViolationStatus.OPEN,
  ParkingViolationStatus.CORRECTIVE_ACTION,
  ParkingViolationStatus.PENDING_CLOSURE,
];

function money(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function groupCount(
  rows: Array<{ key: string; count: number }>,
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) m[r.key] = r.count;
  return m;
}

/**
 * Module 13-Q — parking reports pack (live period counts + current occupancy).
 * RBAC: parking.manage or reporting.read; site ABAC via JWT allowedSiteIds.
 */
@Injectable()
export class ParkingReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async build(
    user: AuthUser,
    from?: string,
    to?: string,
    siteId?: string,
  ): Promise<ParkingReportResponseDto> {
    const period = this.resolvePeriod(from, to);
    const orgId = user.organizationId;
    const siteFilter = siteScopeWhere(user, siteId);
    const baseWhere = { organizationId: orgId, ...siteFilter };
    const periodRecorded = {
      recordedAt: { gte: period.from, lte: period.to },
    };
    const periodInspected = {
      inspectedAt: { gte: period.from, lte: period.to },
    };
    const periodCreated = {
      createdAt: { gte: period.from, lte: period.to },
    };
    const periodBilled = {
      billedAt: { gte: period.from, lte: period.to },
    };

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
    const parkingSiteIds =
      siteIds.length > 0
        ? (
            await this.prisma.parkingSpace.groupBy({
              by: ['siteId'],
              where: {
                organizationId: orgId,
                isActive: true,
                siteId: { in: siteIds },
              },
            })
          ).map((r) => r.siteId)
        : [];

    const [
      registeredVehicles,
      activePermits,
      pendingPermits,
      entries,
      exits,
      allowed,
      denied,
      openEntryRows,
      exitedPairs,
      spaceAgg,
      visitorPermitsActive,
      visitorPermitsPeriod,
      contractorPermitsActive,
      employeePermitsActive,
      employeePermitsPeriod,
      customerEmployeeVehicles,
      fleetVehicles,
      violationsPeriod,
      violationsOpen,
      violationsClosedPeriod,
      violationTypeRows,
      violationsBilledPeriod,
      blacklistActive,
      blacklistAdded,
      patrolsPeriod,
      patrolHigh,
      patrolAccidents,
      patrolSuspicious,
      patrolIllegal,
      patrolTypeRows,
      permitsBilledPeriod,
      violationsBilledRows,
      incidentsPeriod,
      incidentsOpen,
      patrolAccidentCount,
      patrolSuspiciousCount,
    ] = await Promise.all([
      this.prisma.vehicle.count({
        where: { ...baseWhere, isActive: true },
      }),
      this.prisma.parkingPermit.count({
        where: { ...baseWhere, status: PermitStatus.ACTIVE },
      }),
      this.prisma.parkingPermit.count({
        where: { ...baseWhere, status: PermitStatus.PENDING },
      }),
      this.prisma.parkingEntry.count({
        where: {
          ...baseWhere,
          ...periodRecorded,
          direction: ParkingEntryDirection.ENTRY,
        },
      }),
      this.prisma.parkingEntry.count({
        where: {
          ...baseWhere,
          ...periodRecorded,
          direction: ParkingEntryDirection.EXIT,
        },
      }),
      this.prisma.parkingEntry.count({
        where: {
          ...baseWhere,
          ...periodRecorded,
          decision: ParkingDecision.ALLOW,
        },
      }),
      this.prisma.parkingEntry.count({
        where: {
          ...baseWhere,
          ...periodRecorded,
          decision: ParkingDecision.DENY,
        },
      }),
      this.prisma.parkingEntry.findMany({
        where: {
          ...baseWhere,
          direction: ParkingEntryDirection.ENTRY,
          decision: ParkingDecision.ALLOW,
        },
        select: { id: true },
        take: 5000,
      }),
      this.prisma.parkingEntry.findMany({
        where: {
          organizationId: orgId,
          pairedEntryId: { not: null },
          ...(siteFilter.siteId !== undefined ? { siteId: siteFilter.siteId } : {}),
        },
        select: { pairedEntryId: true },
        take: 5000,
      }),
      this.prisma.parkingSpace.groupBy({
        by: ['status'],
        where: { ...baseWhere, isActive: true },
        _count: { _all: true },
      }),
      this.prisma.parkingPermit.count({
        where: {
          ...baseWhere,
          status: PermitStatus.ACTIVE,
          permitType: PermitType.VISITOR,
        },
      }),
      this.prisma.parkingPermit.count({
        where: {
          ...baseWhere,
          permitType: PermitType.VISITOR,
          createdAt: { gte: period.from, lte: period.to },
        },
      }),
      this.prisma.parkingPermit.count({
        where: {
          ...baseWhere,
          status: PermitStatus.ACTIVE,
          permitType: PermitType.CONTRACTOR,
        },
      }),
      this.prisma.parkingPermit.count({
        where: {
          ...baseWhere,
          status: PermitStatus.ACTIVE,
          permitType: PermitType.EMPLOYEE,
        },
      }),
      this.prisma.parkingPermit.count({
        where: {
          ...baseWhere,
          permitType: PermitType.EMPLOYEE,
          createdAt: { gte: period.from, lte: period.to },
        },
      }),
      this.prisma.vehicle.count({
        where: {
          ...baseWhere,
          isActive: true,
          parkingCategory: ParkingCategory.CUSTOMER_EMPLOYEE,
        },
      }),
      this.prisma.vehicle.count({
        where: {
          ...baseWhere,
          isActive: true,
          parkingCategory: {
            in: [
              ParkingCategory.COMPANY,
              ParkingCategory.PATROL,
              ParkingCategory.EMERGENCY,
            ],
          },
        },
      }),
      this.prisma.parkingViolation.count({
        where: { ...baseWhere, ...periodRecorded },
      }),
      this.prisma.parkingViolation.count({
        where: { ...baseWhere, status: { in: OPEN_VIOLATION } },
      }),
      this.prisma.parkingViolation.count({
        where: {
          ...baseWhere,
          status: {
            in: [
              ParkingViolationStatus.CLOSED,
              ParkingViolationStatus.RESOLVED,
            ],
          },
          closedAt: { gte: period.from, lte: period.to },
        },
      }),
      this.prisma.parkingViolation.groupBy({
        by: ['violationType'],
        where: { ...baseWhere, ...periodRecorded },
        _count: { _all: true },
      }),
      this.prisma.parkingViolation.count({
        where: {
          ...baseWhere,
          invoiceId: { not: null },
          ...periodBilled,
        },
      }),
      this.prisma.vehicleBlacklist.count({
        where: { organizationId: orgId, isActive: true },
      }),
      this.prisma.vehicleBlacklist.count({
        where: { organizationId: orgId, ...periodCreated },
      }),
      this.prisma.parkingPatrolObservation.count({
        where: { ...baseWhere, ...periodInspected },
      }),
      this.prisma.parkingPatrolObservation.count({
        where: {
          ...baseWhere,
          ...periodInspected,
          severity: { in: ['HIGH', 'CRITICAL'] },
        },
      }),
      this.prisma.parkingPatrolObservation.count({
        where: {
          ...baseWhere,
          ...periodInspected,
          observationType: ParkingPatrolObservationType.ACCIDENT,
        },
      }),
      this.prisma.parkingPatrolObservation.count({
        where: {
          ...baseWhere,
          ...periodInspected,
          observationType: ParkingPatrolObservationType.SUSPICIOUS_ACTIVITY,
        },
      }),
      this.prisma.parkingPatrolObservation.count({
        where: {
          ...baseWhere,
          ...periodInspected,
          observationType: ParkingPatrolObservationType.ILLEGAL_PARKING,
        },
      }),
      this.prisma.parkingPatrolObservation.groupBy({
        by: ['observationType'],
        where: { ...baseWhere, ...periodInspected },
        _count: { _all: true },
      }),
      this.prisma.parkingPermit.findMany({
        where: {
          ...baseWhere,
          invoiceId: { not: null },
          ...periodBilled,
        },
        select: { feeAmount: true, currency: true },
      }),
      this.prisma.parkingViolation.findMany({
        where: {
          ...baseWhere,
          invoiceId: { not: null },
          ...periodBilled,
        },
        select: {
          fineAmount: true,
          discountAmount: true,
          currency: true,
        },
      }),
      parkingSiteIds.length
        ? this.prisma.incident.count({
            where: {
              organizationId: orgId,
              siteId: { in: parkingSiteIds },
              createdAt: { gte: period.from, lte: period.to },
            },
          })
        : Promise.resolve(0),
      parkingSiteIds.length
        ? this.prisma.incident.count({
            where: {
              organizationId: orgId,
              siteId: { in: parkingSiteIds },
              status: { in: OPEN_INCIDENT },
            },
          })
        : Promise.resolve(0),
      this.prisma.parkingPatrolObservation.count({
        where: {
          ...baseWhere,
          ...periodInspected,
          observationType: ParkingPatrolObservationType.ACCIDENT,
        },
      }),
      this.prisma.parkingPatrolObservation.count({
        where: {
          ...baseWhere,
          ...periodInspected,
          observationType: ParkingPatrolObservationType.SUSPICIOUS_ACTIVITY,
        },
      }),
    ]);

    const exitedSet = new Set(
      exitedPairs.map((r) => r.pairedEntryId).filter(Boolean) as string[],
    );
    const openVisits = openEntryRows.filter((e) => !exitedSet.has(e.id)).length;

    const spaceByStatus = new Map(
      spaceAgg.map((r) => [r.status, r._count._all]),
    );
    const available = spaceByStatus.get(ParkingSpaceStatus.AVAILABLE) ?? 0;
    const occupied = spaceByStatus.get(ParkingSpaceStatus.OCCUPIED) ?? 0;
    const reserved = spaceByStatus.get(ParkingSpaceStatus.RESERVED) ?? 0;
    const outOfService =
      spaceByStatus.get(ParkingSpaceStatus.OUT_OF_SERVICE) ?? 0;
    const totalSpaces = available + occupied + reserved + outOfService;
    const utilBase = totalSpaces - outOfService;
    const utilizationPercent =
      utilBase > 0 ? roundMoney((occupied / utilBase) * 100) : 0;

    const visitorEntries = await this.prisma.parkingEntry.count({
      where: {
        ...baseWhere,
        ...periodRecorded,
        direction: ParkingEntryDirection.ENTRY,
        visitorAppointmentId: { not: null },
      },
    });

    const violationByType = groupCount(
      violationTypeRows.map((r) => ({
        key: r.violationType,
        count: r._count._all,
      })),
    );
    const patrolByType = groupCount(
      patrolTypeRows.map((r) => ({
        key: r.observationType,
        count: r._count._all,
      })),
    );

    const permitRevenue = roundMoney(
      permitsBilledPeriod.reduce((s, p) => s + money(p.feeAmount), 0),
    );
    const violationRevenue = roundMoney(
      violationsBilledRows.reduce(
        (s, v) =>
          s +
          Math.max(
            0,
            money(v.fineAmount) - money(v.discountAmount),
          ),
        0,
      ),
    );
    const currency =
      permitsBilledPeriod[0]?.currency ??
      violationsBilledRows[0]?.currency ??
      'TZS';

    const bySite: ParkingReportResponseDto['bySite'] = [];
    for (const site of sites) {
      const siteWhere = { organizationId: orgId, siteId: site.id };
      const [
        siteEntries,
        siteExits,
        siteDenied,
        sitePermits,
        siteViolations,
        siteSpaces,
        siteOccupied,
      ] = await Promise.all([
        this.prisma.parkingEntry.count({
          where: {
            ...siteWhere,
            ...periodRecorded,
            direction: ParkingEntryDirection.ENTRY,
          },
        }),
        this.prisma.parkingEntry.count({
          where: {
            ...siteWhere,
            ...periodRecorded,
            direction: ParkingEntryDirection.EXIT,
          },
        }),
        this.prisma.parkingEntry.count({
          where: {
            ...siteWhere,
            ...periodRecorded,
            decision: ParkingDecision.DENY,
          },
        }),
        this.prisma.parkingPermit.count({
          where: { ...siteWhere, status: PermitStatus.ACTIVE },
        }),
        this.prisma.parkingViolation.count({
          where: { ...siteWhere, ...periodRecorded },
        }),
        this.prisma.parkingSpace.count({
          where: { ...siteWhere, isActive: true },
        }),
        this.prisma.parkingSpace.count({
          where: {
            ...siteWhere,
            isActive: true,
            status: ParkingSpaceStatus.OCCUPIED,
          },
        }),
      ]);
      const siteUtilBase = siteSpaces;
      bySite.push({
        siteId: site.id,
        siteCode: site.code,
        siteName: site.name,
        entries: siteEntries,
        exits: siteExits,
        denied: siteDenied,
        activePermits: sitePermits,
        violations: siteViolations,
        spacesTotal: siteSpaces,
        spacesOccupied: siteOccupied,
        utilizationPercent:
          siteUtilBase > 0
            ? roundMoney((siteOccupied / siteUtilBase) * 100)
            : 0,
      });
    }

    const report: ParkingReportResponseDto = {
      organizationId: orgId,
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
      },
      siteId: siteId ?? null,
      summary: {
        sitesInScope: sites.length,
        registeredVehicles,
        activePermits,
        pendingPermits,
      },
      entriesExits: {
        entries,
        exits,
        allowed,
        denied,
        openVisits,
      },
      occupancy: {
        totalSpaces,
        available,
        occupied,
        reserved,
        outOfService,
        utilizationPercent,
      },
      visitorParking: {
        activeVisitorPermits: visitorPermitsActive,
        visitorPermitsIssuedInPeriod: visitorPermitsPeriod,
        visitorEntries,
        activeContractorPermits: contractorPermitsActive,
      },
      employeeParking: {
        activeEmployeePermits: employeePermitsActive,
        employeePermitsIssuedInPeriod: employeePermitsPeriod,
        customerEmployeeVehicles,
        fleetVehicles,
      },
      violations: {
        recordedInPeriod: violationsPeriod,
        openNow: violationsOpen,
        closedInPeriod: violationsClosedPeriod,
        byType: violationByType,
        finesBilledInPeriod: violationsBilledPeriod,
        finesRevenueBilled: violationRevenue,
      },
      blacklist: {
        activePlates: blacklistActive,
        addedInPeriod: blacklistAdded,
      },
      patrols: {
        observationsInPeriod: patrolsPeriod,
        highSeverity: patrolHigh,
        accidents: patrolAccidents,
        suspiciousActivity: patrolSuspicious,
        illegalParking: patrolIllegal,
        byType: patrolByType,
      },
      revenue: {
        currency,
        permitInvoicesBilledInPeriod: permitsBilledPeriod.length,
        permitRevenueBilled: permitRevenue,
        violationInvoicesBilledInPeriod: violationsBilledRows.length,
        violationRevenueBilled: violationRevenue,
        totalBilledInPeriod: roundMoney(permitRevenue + violationRevenue),
      },
      securityIncidents: {
        incidentsInPeriod: incidentsPeriod,
        incidentsOpenNow: incidentsOpen,
        patrolAccidentsInPeriod: patrolAccidentCount,
        patrolSuspiciousInPeriod: patrolSuspiciousCount,
      },
      bySite,
      generatedAt: new Date().toISOString(),
      notes: [
        'Live period counts from operational tables — not snapshot KPI cache.',
        'occupancy / openVisits are current-state (not period-limited).',
        'revenue sums permit/violation billedAt in period — not finance cash collected.',
        'securityIncidents = incidents at sites with parking spaces configured.',
        'Executive viewers: reporting.read; ops: parking.manage; site ABAC enforced.',
        'Deferred: PDF pack, charts, stall sensor maps, owner self-pay portal.',
      ],
    };

    await this.audit.record({
      organizationId: orgId,
      actorId: user.id,
      action: 'parking.reports.generated',
      resourceType: 'ParkingReport',
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
