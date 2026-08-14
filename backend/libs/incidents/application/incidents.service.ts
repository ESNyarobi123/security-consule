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
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  IncidentCategoryOptionDto,
  IncidentOfficerOptionDto,
  IncidentResponseDto,
  UpdateIncidentStatusDto,
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
  locationDescription: string | null;
  actionTaken: string | null;
  resolution: string | null;
  latitude: number | null;
  longitude: number | null;
  occurredAt: Date;
  deviceReportedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  closedBy: string | null;
  closedAt: Date | null;
  closureApprovalNote: string | null;
  createdAt: Date;
};

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  categoryOptions(): IncidentCategoryOptionDto[] {
    const integrationOnly = new Set([
      'PATROL_ISSUE',
      'CCTV_ALERT',
      'ACCESS_BREACH',
      'PROPERTY_DAMAGE',
      'SUSPICIOUS_ACTIVITY',
    ]);
    return INCIDENT_CATEGORIES.filter((value) => !integrationOnly.has(value)).map(
      (value) => ({
        value,
        label: INCIDENT_CATEGORY_LABELS[value],
      }),
    );
  }

  async officerOptions(user: AuthUser): Promise<IncidentOfficerOptionDto[]> {
    if (
      isGuardSelfScoped(user) ||
      !!user.customerId ||
      !!user.supplierId ||
      !!user.b2bPartnerId
    ) {
      throw new ForbiddenException({
        error: 'OFFICER_DIRECTORY_DENIED',
        message: 'This account cannot browse the internal officer directory',
      });
    }
    const users = await this.prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        customerId: null,
        supplierId: null,
        b2bPartnerId: null,
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
      take: 300,
    });
    return users;
  }

  private async assertResponsibleOfficer(
    organizationId: string,
    userId?: string | null,
  ): Promise<void> {
    if (!userId) return;
    const officer = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        isActive: true,
        customerId: null,
        supplierId: null,
        b2bPartnerId: null,
      },
      select: { id: true },
    });
    if (!officer) {
      throw new BadRequestException({
        error: 'INVALID_RESPONSIBLE_OFFICER',
        message: 'Responsible officer must be an active internal user',
      });
    }
  }

  private async userNames(
    organizationId: string,
    ids: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { organizationId, id: { in: unique } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

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
    await this.assertResponsibleOfficer(user.organizationId, dto.assignedTo);

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
        const names = await this.userNames(user.organizationId, [
          dup.reporterId,
          dup.assignedTo,
          dup.resolvedBy,
          dup.closedBy,
        ]);
        return this.toDto(dup, dupSite ?? undefined, user, names);
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
          assignedTo: dto.assignedTo,
          locationDescription: dto.locationDescription?.trim() || undefined,
          latitude: dto.latitude,
          longitude: dto.longitude,
          occurredAt: dto.occurredAt
            ? new Date(dto.occurredAt)
            : dto.deviceReportedAt
              ? new Date(dto.deviceReportedAt)
              : new Date(),
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

    const names = await this.userNames(user.organizationId, [
      incident.reporterId,
      incident.assignedTo,
    ]);
    return this.toDto(incident, site, user, names);
  }

  async updateStatus(
    id: string,
    dto: UpdateIncidentStatusDto,
    user: AuthUser,
  ): Promise<IncidentResponseDto> {
    this.assertCanChangeStatus(user);
    const { status } = dto;

    const existing = await this.prisma.incident.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Incident not found');
    assertSiteAccess(user, existing.siteId);
    await this.assertResponsibleOfficer(user.organizationId, dto.assignedTo);
    if (existing.status === IncidentStatus.CLOSED) {
      throw new BadRequestException({
        error: 'INCIDENT_CLOSED_IMMUTABLE',
        message: 'Closed incident records cannot be changed',
      });
    }

    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${existing.status} to ${status}`,
      );
    }

    const gate = this.statusGate(user, existing, status);
    if (!gate.ok) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: gate.reason,
        requiredRoleHint: gate.requiredRoleHint,
      });
    }

    const resolution = dto.resolution?.trim() || existing.resolution;
    if (
      (status === IncidentStatus.RESOLVED ||
        status === IncidentStatus.CLOSED) &&
      !resolution
    ) {
      throw new BadRequestException({
        error: 'RESOLUTION_REQUIRED',
        message: 'Resolution is required before an incident can be resolved',
      });
    }
    const closureApprovalNote = dto.closureApprovalNote?.trim();
    if (status === IncidentStatus.CLOSED && !closureApprovalNote) {
      throw new BadRequestException({
        error: 'CLOSURE_APPROVAL_REQUIRED',
        message: 'An authorized closure approval note is required',
      });
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status,
        ...(dto.assignedTo !== undefined ? { assignedTo: dto.assignedTo } : {}),
        ...(dto.actionTaken !== undefined
          ? { actionTaken: dto.actionTaken.trim() || null }
          : {}),
        ...(resolution &&
        (status === IncidentStatus.RESOLVED ||
          status === IncidentStatus.CLOSED)
          ? { resolution }
          : {}),
        resolvedAt:
          status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED
            ? existing.resolvedAt ?? new Date()
            : undefined,
        ...(status === IncidentStatus.RESOLVED
          ? { resolvedBy: existing.resolvedBy ?? user.id }
          : {}),
        ...(status === IncidentStatus.CLOSED
          ? {
              closedBy: user.id,
              closedAt: new Date(),
              closureApprovalNote,
            }
          : {}),
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
        assignedTo: updated.assignedTo,
        actionTaken: updated.actionTaken,
        resolution: updated.resolution,
        resolvedBy: updated.resolvedBy,
        closedBy: updated.closedBy,
        closedAt: updated.closedAt,
        closureApprovalNote: updated.closureApprovalNote,
        actorRoles: user.roles,
      },
    });

    const site = await this.prisma.site.findFirst({
      where: { id: updated.siteId, organizationId: user.organizationId },
      select: { code: true, name: true },
    });

    const names = await this.userNames(user.organizationId, [
      updated.reporterId,
      updated.assignedTo,
      updated.resolvedBy,
      updated.closedBy,
    ]);
    return this.toDto(updated, site ?? undefined, user, names);
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
    const names = await this.userNames(
      organizationId,
      rows.flatMap((r) => [
        r.reporterId,
        r.assignedTo,
        r.resolvedBy,
        r.closedBy,
      ]),
    );

    return rows.map((r) => this.toDto(r, siteMap.get(r.siteId), user, names));
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
      if (incident.resolvedBy && incident.resolvedBy === user.id) {
        return {
          ok: false,
          reason: 'Resolver cannot approve closure of the same incident',
          requiredRoleHint: 'Another authorized closure officer',
        };
      }
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
    names?: Map<string, string>,
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
      reporterName: names?.get(i.reporterId) ?? null,
      assignedTo: i.assignedTo,
      assignedToName: i.assignedTo
        ? names?.get(i.assignedTo) ?? null
        : null,
      locationDescription: i.locationDescription,
      latitude: i.latitude,
      longitude: i.longitude,
      actionTaken: i.actionTaken,
      resolution: i.resolution,
      occurredAt: i.occurredAt,
      deviceReportedAt: i.deviceReportedAt,
      resolvedAt: i.resolvedAt,
      resolvedBy: i.resolvedBy,
      resolvedByName: i.resolvedBy
        ? names?.get(i.resolvedBy) ?? null
        : null,
      closedBy: i.closedBy,
      closedByName: i.closedBy ? names?.get(i.closedBy) ?? null : null,
      closedAt: i.closedAt,
      closureApprovalNote: i.closureApprovalNote,
      createdAt: i.createdAt,
      allowedNextStatuses: next.allowedNextStatuses,
      blockedReason: next.blockedReason,
      requiredRoleHint: next.requiredRoleHint,
    };
  }
}
