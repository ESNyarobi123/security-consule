import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IncidentSeverity, IncidentStatus, Prisma } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
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

type IncidentRow = {
  id: string;
  incidentNumber: string;
  siteId: string;
  category: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
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
        return this.toDto(dup, dupSite ?? undefined);
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
      // RLS may hide another org's row on findUnique; unique still fires on insert.
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

    return this.toDto(incident, site);
  }

  async updateStatus(
    id: string,
    status: IncidentStatus,
    assignedTo: string | undefined,
    user: AuthUser,
  ): Promise<IncidentResponseDto> {
    const existing = await this.prisma.incident.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Incident not found');

    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${existing.status} to ${status}`,
      );
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
      before: existing,
      after: updated,
    });

    const site = await this.prisma.site.findFirst({
      where: { id: updated.siteId, organizationId: user.organizationId },
      select: { code: true, name: true },
    });

    return this.toDto(updated, site ?? undefined);
  }

  async list(
    organizationId: string,
    siteId?: string,
  ): Promise<IncidentResponseDto[]> {
    const rows = await this.prisma.incident.findMany({
      where: { organizationId, ...(siteId ? { siteId } : {}) },
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

    return rows.map((r) => this.toDto(r, siteMap.get(r.siteId)));
  }

  private toDto(
    i: IncidentRow,
    site?: { code: string; name: string } | null,
  ): IncidentResponseDto {
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
      assignedTo: i.assignedTo,
      resolvedAt: i.resolvedAt,
      createdAt: i.createdAt,
    };
  }
}
