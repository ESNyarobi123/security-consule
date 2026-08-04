import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IncidentSeverity, IncidentStatus, Prisma } from '@prisma/client';
import {
  PrismaService,
  AuthUser,
  assertSiteAccess,
  isGuardSelfScoped,
  siteScopeWhere,
} from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateIncidentDto,
  IncidentResponseDto,
} from '../presentation/dto/incident.dto';

/** Thin escalate path: forward-only (same status allowed as no-op). */
const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.OPEN]: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING],
  [IncidentStatus.INVESTIGATING]: [
    IncidentStatus.INVESTIGATING,
    IncidentStatus.RESOLVED,
  ],
  [IncidentStatus.RESOLVED]: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED],
  [IncidentStatus.CLOSED]: [IncidentStatus.CLOSED],
};

/** Staff who may change status despite also holding GUARD (mobile). */
const INCIDENT_STATUS_STAFF_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'SUPERVISOR',
  'FIELD_OFFICER',
  'BRANCH_MANAGER',
  'OPERATIONS_MANAGER',
  'CONTROL_ROOM',
  'CEO',
  'CMD',
  'DEVELOPER',
  'HR_OFFICER',
  'LEGAL',
  'MARKETING',
  'COMPLIANCE_OFFICER',
]);

/** Can close non-CRITICAL (BOM / Ops Mgr / GM+). */
const INCIDENT_CLOSE_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'BRANCH_MANAGER',
  'OPERATIONS_MANAGER',
  'CEO',
  'CMD',
  'DEVELOPER',
]);

/** CRITICAL close requires GM or CEO (or SuperAdmin/CMD). */
const INCIDENT_CRITICAL_CLOSE_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'CEO',
  'CMD',
]);

type IncidentRow = {
  id: string;
  incidentNumber: string;
  siteId: string;
  category: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  reporterId: string;
  assignedTo: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateIncidentDto,
    user: AuthUser,
  ): Promise<IncidentResponseDto> {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, organizationId: user.organizationId },
      select: { id: true, code: true, name: true },
    });
    if (!site) throw new BadRequestException('Site not found in organization');
    assertSiteAccess(user, dto.siteId);

    if (dto.clientEventId) {
      const dup = await this.prisma.incident.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (dup) {
        if (dup.organizationId !== user.organizationId) {
          throw new ConflictException(
            'clientEventId already used by another organization',
          );
        }
        const dupSite = await this.prisma.site.findFirst({
          where: { id: dup.siteId, organizationId: user.organizationId },
          select: { code: true, name: true },
        });
        return this.toDto(dup, dupSite ?? undefined, user);
      }
    }

    const count = await this.prisma.incident.count({
      where: { organizationId: user.organizationId },
    });
    const incidentNumber = `INC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    let incident;
    try {
      incident = await this.prisma.incident.create({
        data: {
          organizationId: user.organizationId,
          siteId: dto.siteId,
          incidentNumber,
          category: dto.category.trim(),
          severity: dto.severity,
          title: dto.title.trim(),
          description: dto.description.trim(),
          reporterId: user.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          deviceReportedAt: dto.deviceReportedAt
            ? new Date(dto.deviceReportedAt)
            : undefined,
          clientEventId: dto.clientEventId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        dto.clientEventId
      ) {
        throw new ConflictException(
          'clientEventId already used by another organization',
        );
      }
      throw err;
    }

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'incident.created',
      resourceType: 'Incident',
      resourceId: incident.id,
      after: incident,
    });

    return this.toDto(incident, site, user);
  }

  async updateStatus(
    id: string,
    status: IncidentStatus,
    assignedTo: string | undefined,
    user: AuthUser,
  ): Promise<IncidentResponseDto> {
    this.assertCanChangeStatus(user);

    const existing = await this.prisma.incident.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Incident not found');
    assertSiteAccess(user, existing.siteId);

    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${existing.status} to ${status}`,
      );
    }

    if (status !== existing.status) {
      const gate = this.statusGate(user, existing, status);
      if (!gate.ok) {
        throw new ForbiddenException({
          error: 'FORBIDDEN',
          message: gate.reason,
          requiredRoleHint: gate.requiredRoleHint,
        });
      }
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status,
        ...(assignedTo !== undefined ? { assignedTo } : {}),
        resolvedAt:
          status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED
            ? existing.resolvedAt ?? new Date()
            : undefined,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: `incident.status.${status.toLowerCase()}`,
      resourceType: 'Incident',
      resourceId: id,
      before: { status: existing.status, severity: existing.severity },
      after: {
        status: updated.status,
        severity: updated.severity,
        actorRoles: user.roles,
      },
    });

    const site = await this.prisma.site.findFirst({
      where: { id: updated.siteId, organizationId: user.organizationId },
      select: { code: true, name: true },
    });

    return this.toDto(updated, site ?? undefined, user);
  }

  async list(
    organizationId: string,
    user: AuthUser,
    siteId?: string,
  ): Promise<IncidentResponseDto[]> {
    const rows = await this.prisma.incident.findMany({
      where: {
        organizationId,
        ...(isGuardSelfScoped(user)
          ? { reporterId: user.id }
          : siteScopeWhere(user, siteId)),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const siteIds = [...new Set(rows.map((r) => r.siteId))];
    const sites =
      siteIds.length === 0
        ? []
        : await this.prisma.site.findMany({
            where: { id: { in: siteIds }, organizationId },
            select: { id: true, code: true, name: true },
          });
    const siteMap = new Map(sites.map((s) => [s.id, s]));

    return rows.map((r) => this.toDto(r, siteMap.get(r.siteId), user));
  }

  /** Guard-only JWT cannot escalate (still may create + list). */
  private assertCanChangeStatus(user: AuthUser): void {
    if (
      user.roles.includes('GUARD') &&
      !user.roles.some((r) => INCIDENT_STATUS_STAFF_ROLES.has(r))
    ) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Guards cannot escalate incident status',
      });
    }
  }

  private isStaff(user: AuthUser): boolean {
    return (
      !user.roles.includes('GUARD') ||
      user.roles.some((r) => INCIDENT_STATUS_STAFF_ROLES.has(r))
    );
  }

  private statusGate(
    user: AuthUser,
    incident: IncidentRow,
    to: IncidentStatus,
  ): { ok: boolean; reason: string; requiredRoleHint?: string } {
    if (
      (to === IncidentStatus.RESOLVED || to === IncidentStatus.CLOSED) &&
      incident.reporterId === user.id
    ) {
      return {
        ok: false,
        reason: 'Reporter cannot resolve or close their own incident',
        requiredRoleHint: 'Another authorized officer',
      };
    }

    if (to === IncidentStatus.INVESTIGATING) {
      if (!this.isStaff(user)) {
        return {
          ok: false,
          reason: 'Guards cannot escalate incident status',
          requiredRoleHint: 'SUPERVISOR',
        };
      }
      return { ok: true, reason: '' };
    }

    if (to === IncidentStatus.RESOLVED) {
      // Supervisor / Field / BOM / Ops Mgr / elevated (not Guard-only)
      const can =
        user.roles.includes('SUPERVISOR') ||
        user.roles.includes('FIELD_OFFICER') ||
        user.roles.includes('CONTROL_ROOM') ||
        user.roles.some((r) => INCIDENT_CLOSE_ROLES.has(r));
      if (!can) {
        return {
          ok: false,
          reason: 'Resolve requires Supervisor, Field/BOM, Control Room, or GM',
          requiredRoleHint: 'SUPERVISOR, FIELD_OFFICER, or CONTROL_ROOM',
        };
      }
      return { ok: true, reason: '' };
    }

    if (to === IncidentStatus.CLOSED) {
      if (incident.severity === IncidentSeverity.CRITICAL) {
        const can = user.roles.some((r) =>
          INCIDENT_CRITICAL_CLOSE_ROLES.has(r),
        );
        if (!can) {
          return {
            ok: false,
            reason: 'CRITICAL close requires GM or CEO',
            requiredRoleHint: 'GENERAL_MANAGER or CEO',
          };
        }
        return { ok: true, reason: '' };
      }
      const can = user.roles.some((r) => INCIDENT_CLOSE_ROLES.has(r));
      if (!can) {
        return {
          ok: false,
          reason: 'Close requires Branch Ops Manager / GM (or above)',
          requiredRoleHint: 'BRANCH_MANAGER or GENERAL_MANAGER',
        };
      }
      return { ok: true, reason: '' };
    }

    return { ok: true, reason: '' };
  }

  private allowedNextForUser(
    user: AuthUser,
    incident: IncidentRow,
  ): {
    allowedNextStatuses: IncidentStatus[];
    blockedReason?: string;
    requiredRoleHint?: string;
  } {
    const candidates = (ALLOWED_TRANSITIONS[incident.status] ?? []).filter(
      (s) => s !== incident.status,
    );
    if (!this.isStaff(user)) {
      return {
        allowedNextStatuses: [],
        blockedReason: 'Guards cannot escalate incident status',
        requiredRoleHint: 'SUPERVISOR',
      };
    }

    const allowed: IncidentStatus[] = [];
    let blockedReason: string | undefined;
    let requiredRoleHint: string | undefined;

    for (const next of candidates) {
      const gate = this.statusGate(user, incident, next);
      if (gate.ok) allowed.push(next);
      else if (!blockedReason) {
        blockedReason = gate.reason;
        requiredRoleHint = gate.requiredRoleHint;
      }
    }

    return { allowedNextStatuses: allowed, blockedReason, requiredRoleHint };
  }

  private toDto(
    i: IncidentRow,
    site: { code: string; name: string } | null | undefined,
    user?: AuthUser,
  ): IncidentResponseDto {
    const next = user
      ? this.allowedNextForUser(user, i)
      : { allowedNextStatuses: [] as IncidentStatus[] };

    return {
      id: i.id,
      incidentNumber: i.incidentNumber,
      siteId: i.siteId,
      siteCode: site?.code,
      siteName: site?.name,
      category: i.category,
      severity: i.severity,
      status: i.status,
      title: i.title,
      description: i.description,
      reporterId: i.reporterId,
      assignedTo: i.assignedTo,
      resolvedAt: i.resolvedAt,
      createdAt: i.createdAt,
      allowedNextStatuses: next.allowedNextStatuses,
      blockedReason: next.blockedReason,
      requiredRoleHint: next.requiredRoleHint,
    };
  }
}
