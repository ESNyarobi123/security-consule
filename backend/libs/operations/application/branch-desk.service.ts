import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  DeploymentStatus,
  ParkingDecision,
  ParkingSpaceStatus,
  ParkingViolationStatus,
} from '@prisma/client';
import { AuditService } from '@pssms/audit';
import { FinanceOpsService } from '@pssms/finance';
import {
  AuthUser,
  PrismaService,
  resolveSiteIdFilter,
  siteScopeWhere,
} from '@pssms/shared';
import { CreateBranchPettyCashDto } from '../presentation/dto/operations.dto';

const OPEN_VIOLATIONS: ParkingViolationStatus[] = [
  ParkingViolationStatus.OPEN,
  ParkingViolationStatus.CORRECTIVE_ACTION,
  ParkingViolationStatus.PENDING_CLOSURE,
];

const INSPECT_CATEGORIES = ['SUPERVISOR_COMMENT', 'HANDOVER_NOTE'];

@Injectable()
export class BranchDeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly finance: FinanceOpsService,
  ) {}

  private assertStaff(user: AuthUser) {
    if (user.customerId || user.supplierId) {
      throw new ForbiddenException({
        error: 'BRANCH_STAFF_ONLY',
        message: 'Branch Operations is staff-only',
      });
    }
  }

  /** null = org-wide; empty = fail-closed. */
  private async opsBranchIds(user: AuthUser): Promise<string[] | null> {
    const siteFilter = resolveSiteIdFilter(user);
    if (siteFilter === null) return null;
    if (user.allowedBranchIds.length) {
      return user.allowedBranchIds;
    }
    if (!siteFilter.length) return [];
    const sites = await this.prisma.site.findMany({
      where: { organizationId: user.organizationId, id: { in: siteFilter } },
      select: { branchId: true },
    });
    return [...new Set(sites.map((s) => s.branchId))];
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

  async deskSummary(user: AuthUser) {
    this.assertStaff(user);
    const org = user.organizationId;
    const siteWhere = siteScopeWhere(user);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const branchIds = await this.opsBranchIds(user);

    const [deployedGuards, parkingDenies, openInspections, pettyPending] =
      await Promise.all([
        this.prisma.guardDeployment.count({
          where: {
            organizationId: org,
            status: DeploymentStatus.ACTIVE,
            ...siteWhere,
          },
        }),
        this.prisma.parkingEntry.count({
          where: {
            organizationId: org,
            recordedAt: { gte: since24h },
            decision: ParkingDecision.DENY,
            ...siteWhere,
          },
        }),
        this.prisma.occurrenceEntry.count({
          where: {
            organizationId: org,
            isCurrent: true,
            category: { in: INSPECT_CATEGORIES },
            ...siteWhere,
          },
        }),
        this.finance.countPendingPettyCashForBranches(org, branchIds),
      ]);

    return {
      deployedGuards,
      parkingDenies24h: parkingDenies,
      inspectionNotes: openInspections,
      pendingPettyCash: pettyPending,
      generatedAt: new Date().toISOString(),
      notes: [
        'Staff roster is deployed guards at assigned sites — HR hire/exit stays /hr.',
        'Parking mutate stays parking-web. Petty cash approve/issue stays Finance.',
        'Business development stays Marketing. CCTV technical stays /cctv.',
      ],
    };
  }

  async staffRoster(user: AuthUser) {
    this.assertStaff(user);
    const org = user.organizationId;
    const rows = await this.prisma.guardDeployment.findMany({
      where: {
        organizationId: org,
        status: DeploymentStatus.ACTIVE,
        ...siteScopeWhere(user),
      },
      orderBy: { startDate: 'desc' },
      take: 200,
      select: {
        id: true,
        siteId: true,
        contractId: true,
        startDate: true,
        status: true,
        guard: {
          select: {
            id: true,
            employeeNumber: true,
            status: true,
            phone: true,
            userId: true,
            deploymentEligible: true,
          },
        },
      },
    });
    const labels = await this.siteLabels(
      org,
      rows.map((r) => r.siteId),
    );
    const userIds = [...new Set(rows.map((r) => r.guard.userId))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { organizationId: org, id: { in: userIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.fullName]));

    await this.audit.record({
      organizationId: org,
      actorId: user.id,
      action: 'operations.staff.listed',
      resourceType: 'BranchStaffRoster',
      after: { count: rows.length },
    });

    return {
      rows: rows.map((r) => {
        const site = labels.get(r.siteId);
        return {
          id: r.id,
          guardId: r.guard.id,
          employeeNumber: r.guard.employeeNumber,
          fullName: names.get(r.guard.userId) ?? r.guard.employeeNumber,
          guardStatus: r.guard.status,
          phone: r.guard.phone,
          siteId: r.siteId,
          siteCode: site?.code ?? null,
          siteName: site?.name ?? null,
          startDate: r.startDate,
          deploymentStatus: r.status,
        };
      }),
      notes: [
        'Deployed guards at sites in your ABAC scope. Create/status stays Guards console (guards.manage).',
        'Office HR register stays /hr — this is field staff on post.',
      ],
    };
  }

  async inspections(user: AuthUser) {
    this.assertStaff(user);
    const org = user.organizationId;
    const rows = await this.prisma.occurrenceEntry.findMany({
      where: {
        organizationId: org,
        isCurrent: true,
        category: { in: INSPECT_CATEGORIES },
        ...siteScopeWhere(user),
      },
      orderBy: { recordedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        siteId: true,
        category: true,
        description: true,
        officerId: true,
        recordedAt: true,
        approvedBy: true,
      },
    });
    const labels = await this.siteLabels(
      org,
      rows.map((r) => r.siteId),
    );
    const officerIds = [
      ...new Set(
        rows.flatMap((r) => [r.officerId, r.approvedBy].filter(Boolean) as string[]),
      ),
    ];
    const users = officerIds.length
      ? await this.prisma.user.findMany({
          where: { organizationId: org, id: { in: officerIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.fullName]));

    return {
      rows: rows.map((r) => {
        const site = labels.get(r.siteId);
        return {
          ...r,
          siteCode: site?.code ?? null,
          siteName: site?.name ?? null,
          officerName: names.get(r.officerId) ?? null,
          approvedByName: r.approvedBy ? names.get(r.approvedBy) ?? null : null,
        };
      }),
      notes: [
        'Supervisor comments and handover notes from the occurrence book. Record/approve stays /branch/eob (recorder ≠ approver).',
      ],
    };
  }

  async parkingMonitor(user: AuthUser) {
    this.assertStaff(user);
    const org = user.organizationId;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const siteWhere = siteScopeWhere(user);

    const [entries, violations, occupied, spacesActive] = await Promise.all([
      this.prisma.parkingEntry.findMany({
        where: {
          organizationId: org,
          recordedAt: { gte: since24h },
          ...siteWhere,
        },
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
        where: {
          organizationId: org,
          status: { in: OPEN_VIOLATIONS },
          ...siteWhere,
        },
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
          ...siteWhere,
        },
      }),
      this.prisma.parkingSpace.count({
        where: { organizationId: org, isActive: true, ...siteWhere },
      }),
    ]);
    const labels = await this.siteLabels(org, [
      ...entries.map((e) => e.siteId),
      ...violations.map((v) => v.siteId),
    ]);
    const withSite = <T extends { siteId: string }>(rows: T[]) =>
      rows.map((r) => {
        const site = labels.get(r.siteId);
        return { ...r, siteCode: site?.code ?? null, siteName: site?.name ?? null };
      });

    return {
      occupancy: {
        occupied,
        spacesActive,
        utilizationPct:
          spacesActive > 0 ? Math.round((occupied / spacesActive) * 100) : null,
      },
      entries: withSite(entries),
      openViolations: withSite(violations),
      notes: [
        'Read-only parking board for field sites. Issue permits, bill, and ANPR decide stay parking-web (parking.manage).',
      ],
    };
  }

  async listPettyCash(user: AuthUser) {
    this.assertStaff(user);
    const branchIds = await this.opsBranchIds(user);
    if (branchIds && branchIds.length === 0) {
      return { rows: [], notes: ['No branch in your site scope.'] };
    }
    const rows = await this.finance.listPettyCashVouchersForBranches(
      user.organizationId,
      branchIds,
    );
    const branches = await this.prisma.branch.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...(branchIds ? { id: { in: branchIds } } : {}),
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    return {
      rows,
      branches,
      notes: [
        'Request here or via ESS. Approve / issue / retire stays Finance (creator ≠ issuer).',
      ],
    };
  }

  async requestPettyCash(dto: CreateBranchPettyCashDto, user: AuthUser) {
    this.assertStaff(user);
    const ids = await this.opsBranchIds(user);
    if (ids) {
      if (ids.length === 0) {
        throw new ForbiddenException({ error: 'BRANCH_SCOPE_DENIED' });
      }
      if (dto.branchId && !ids.includes(dto.branchId)) {
        throw new ForbiddenException({ error: 'BRANCH_SCOPE_DENIED' });
      }
      if (!dto.branchId) {
        if (ids.length !== 1) {
          throw new ForbiddenException({
            error: 'BRANCH_REQUIRED',
            message: 'Choose a branch in your scope',
          });
        }
        dto.branchId = ids[0];
      }
    }
    const row = await this.finance.createEssPettyCashVoucher(dto, user, 'ops');
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'operations.petty_cash.requested',
      resourceType: 'PettyCashVoucher',
      resourceId: row.id,
      after: { voucherNumber: row.voucherNumber, channel: 'ops' },
    });
    return row;
  }
}
