import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import {
  CreateIncidentDto,
  IncidentResponseDto,
} from '../presentation/dto/incident.dto';

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
    if (dto.clientEventId) {
      const dup = await this.prisma.incident.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (dup) return this.toDto(dup);
    }

    const count = await this.prisma.incident.count({
      where: { organizationId: user.organizationId },
    });
    const incidentNumber = `INC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const incident = await this.prisma.incident.create({
      data: {
        organizationId: user.organizationId,
        siteId: dto.siteId,
        incidentNumber,
        category: dto.category,
        severity: dto.severity,
        title: dto.title,
        description: dto.description,
        reporterId: user.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        deviceReportedAt: dto.deviceReportedAt
          ? new Date(dto.deviceReportedAt)
          : undefined,
        clientEventId: dto.clientEventId,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'incident.created',
      resourceType: 'Incident',
      resourceId: incident.id,
      after: incident,
    });

    return this.toDto(incident);
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

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status,
        assignedTo,
        resolvedAt:
          status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED
            ? new Date()
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

    return this.toDto(updated);
  }

  async list(organizationId: string, siteId?: string) {
    return this.prisma.incident.findMany({
      where: { organizationId, ...(siteId ? { siteId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private toDto(i: {
    id: string;
    incidentNumber: string;
    siteId: string;
    category: string;
    severity: import('@prisma/client').IncidentSeverity;
    status: IncidentStatus;
    title: string;
    createdAt: Date;
  }): IncidentResponseDto {
    return {
      id: i.id,
      incidentNumber: i.incidentNumber,
      siteId: i.siteId,
      category: i.category,
      severity: i.severity,
      status: i.status,
      title: i.title,
      createdAt: i.createdAt,
    };
  }
}
