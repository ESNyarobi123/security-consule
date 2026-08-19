import { Injectable } from '@nestjs/common';
import { DeploymentStatus } from '@prisma/client';
import { AuthUser, PrismaService, requireCustomerScope } from '@pssms/shared';

export type CustomerPortalSiteDto = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
};

export type CustomerPortalDeploymentDto = {
  id: string;
  status: string;
  startAt: Date;
  endAt: Date | null;
  site: { id: string; code: string; name: string };
  guard: {
    id: string;
    guardNumber: string;
    status: string;
    deploymentEligible: boolean;
    fullName: string | null;
  };
};

export type CustomerPortalIncidentDto = {
  id: string;
  incidentNumber: string;
  siteId: string;
  siteCode: string | null;
  siteName: string | null;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  resolvedAt: Date | null;
  createdAt: Date;
};

export type CustomerPortalAttendanceClockedGuardDto = {
  guardId: string;
  guardNumber: string;
  fullName: string | null;
  clockInAt: Date;
  stillOnDuty: boolean;
};

export type CustomerPortalAttendanceSummaryDto = {
  siteId: string;
  siteCode: string;
  siteName: string;
  clockedInToday: number;
  onDutyNow: number;
  totalActiveDeployments: number;
  clockedGuards: CustomerPortalAttendanceClockedGuardDto[];
};

/** Portal 35.8 — gate IN/OUT at this customer's sites only (not org-wide entries). */
export type CustomerPortalVisitorEntryDto = {
  id: string;
  siteId: string;
  siteCode: string | null;
  siteName: string | null;
  gateId: string | null;
  gateCode: string | null;
  gateName: string | null;
  visitorName: string;
  result: string;
  direction: string;
  denyReason: string | null;
  recordedAt: Date;
  appointmentId: string | null;
  referenceNumber: string | null;
};

@Injectable()
export class CustomerPortalOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSites(user: AuthUser): Promise<CustomerPortalSiteDto[]> {
    const customerId = requireCustomerScope(user);
    return this.prisma.site.findMany({
      where: {
        organizationId: user.organizationId,
        customerId,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        isActive: true,
      },
    });
  }

  async listDeployments(
    user: AuthUser,
  ): Promise<CustomerPortalDeploymentDto[]> {
    const sites = await this.customerSites(user);
    if (sites.length === 0) return [];

    const siteIds = sites.map((s) => s.id);
    const siteById = new Map(sites.map((s) => [s.id, s]));
    const endedSince = new Date();
    endedSince.setDate(endedSince.getDate() - 7);

    const rows = await this.prisma.guardDeployment.findMany({
      where: {
        organizationId: user.organizationId,
        siteId: { in: siteIds },
        OR: [
          { status: DeploymentStatus.ACTIVE },
          {
            status: DeploymentStatus.ENDED,
            OR: [
              { endDate: { gte: endedSince } },
              { endDate: null, createdAt: { gte: endedSince } },
            ],
          },
        ],
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: {
        guard: {
          select: {
            id: true,
            employeeNumber: true,
            status: true,
            deploymentEligible: true,
            employee: { select: { fullName: true } },
          },
        },
      },
    });

    return rows.map((d) => {
      const site = siteById.get(d.siteId)!;
      return {
        id: d.id,
        status: d.status,
        startAt: d.startDate,
        endAt: d.endDate,
        site: { id: site.id, code: site.code, name: site.name },
        guard: {
          id: d.guard.id,
          guardNumber: d.guard.employeeNumber,
          status: d.guard.status,
          deploymentEligible: d.guard.deploymentEligible,
          fullName: d.guard.employee?.fullName ?? null,
        },
      };
    });
  }

  async listIncidents(user: AuthUser): Promise<CustomerPortalIncidentDto[]> {
    const sites = await this.customerSites(user);
    if (sites.length === 0) return [];

    const siteIds = sites.map((s) => s.id);
    const siteById = new Map(sites.map((s) => [s.id, s]));

    const rows = await this.prisma.incident.findMany({
      where: {
        organizationId: user.organizationId,
        siteId: { in: siteIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows.map((i) => {
      const site = siteById.get(i.siteId);
      return {
        id: i.id,
        incidentNumber: i.incidentNumber,
        siteId: i.siteId,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        category: i.category,
        severity: i.severity,
        status: i.status,
        title: i.title,
        description: i.description,
        resolvedAt: i.resolvedAt,
        createdAt: i.createdAt,
      };
    });
  }

  async listVisitorEntries(
    user: AuthUser,
  ): Promise<CustomerPortalVisitorEntryDto[]> {
    const sites = await this.customerSites(user);
    if (sites.length === 0) return [];

    const siteIds = sites.map((s) => s.id);
    const siteById = new Map(sites.map((s) => [s.id, s]));

    const rows = await this.prisma.visitorEntry.findMany({
      where: {
        organizationId: user.organizationId,
        siteId: { in: siteIds },
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
      include: {
        appointment: {
          select: {
            referenceNumber: true,
          },
        },
      },
    });

    const gateIds = [
      ...new Set(
        rows
          .map((r) => r.gateId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const gates =
      gateIds.length === 0
        ? []
        : await this.prisma.gate.findMany({
            where: {
              organizationId: user.organizationId,
              id: { in: gateIds },
            },
            select: { id: true, code: true, name: true },
          });
    const gateById = new Map(gates.map((g) => [g.id, g]));

    return rows.map((e) => {
      const site = siteById.get(e.siteId);
      const gate = e.gateId ? gateById.get(e.gateId) : undefined;
      return {
        id: e.id,
        siteId: e.siteId,
        siteCode: site?.code ?? null,
        siteName: site?.name ?? null,
        gateId: e.gateId,
        gateCode: gate?.code ?? null,
        gateName: gate?.name ?? null,
        visitorName: e.visitorName,
        result: e.result,
        direction: e.direction,
        denyReason: e.denyReason,
        recordedAt: e.recordedAt,
        appointmentId: e.appointmentId,
        referenceNumber: e.appointment?.referenceNumber ?? null,
      };
    });
  }

  async attendanceSummary(
    user: AuthUser,
  ): Promise<CustomerPortalAttendanceSummaryDto[]> {
    const sites = await this.customerSites(user);
    if (sites.length === 0) return [];

    const siteIds = sites.map((s) => s.id);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [attendanceRows, deploymentGroups] = await Promise.all([
      this.prisma.guardAttendance.findMany({
        where: {
          organizationId: user.organizationId,
          siteId: { in: siteIds },
          clockInAt: { gte: dayStart, lt: dayEnd },
        },
        orderBy: { clockInAt: 'desc' },
        select: {
          siteId: true,
          guardId: true,
          clockInAt: true,
          clockOutAt: true,
          guard: {
            select: {
              employeeNumber: true,
              employee: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.guardDeployment.groupBy({
        by: ['siteId'],
        where: {
          organizationId: user.organizationId,
          siteId: { in: siteIds },
          status: DeploymentStatus.ACTIVE,
        },
        _count: { _all: true },
      }),
    ]);

    /** Latest clock-in today per site+guard (rows already newest-first). */
    const latestBySiteGuard = new Map<
      string,
      (typeof attendanceRows)[number]
    >();
    for (const row of attendanceRows) {
      const key = `${row.siteId}:${row.guardId}`;
      if (!latestBySiteGuard.has(key)) latestBySiteGuard.set(key, row);
    }

    const guardsBySite = new Map<
      string,
      CustomerPortalAttendanceClockedGuardDto[]
    >();
    for (const row of latestBySiteGuard.values()) {
      const list = guardsBySite.get(row.siteId) ?? [];
      list.push({
        guardId: row.guardId,
        guardNumber: row.guard.employeeNumber,
        fullName: row.guard.employee?.fullName ?? null,
        clockInAt: row.clockInAt,
        stillOnDuty: row.clockOutAt == null,
      });
      guardsBySite.set(row.siteId, list);
    }
    for (const [, list] of guardsBySite) {
      list.sort(
        (a, b) =>
          new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime(),
      );
    }

    const deployMap = new Map(
      deploymentGroups.map((g) => [g.siteId, g._count._all]),
    );

    return sites.map((s) => {
      const clockedGuards = guardsBySite.get(s.id) ?? [];
      return {
        siteId: s.id,
        siteCode: s.code,
        siteName: s.name,
        clockedInToday: clockedGuards.length,
        onDutyNow: clockedGuards.filter((g) => g.stillOnDuty).length,
        totalActiveDeployments: deployMap.get(s.id) ?? 0,
        clockedGuards,
      };
    });
  }

  private async customerSites(user: AuthUser) {
    const customerId = requireCustomerScope(user);
    return this.prisma.site.findMany({
      where: {
        organizationId: user.organizationId,
        customerId,
      },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
