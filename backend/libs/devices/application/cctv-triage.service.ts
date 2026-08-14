import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeviceEventType, IncidentSeverity } from '@prisma/client';
import { PrismaService, AuthUser } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { IncidentsService } from '@pssms/incidents';
import {
  AcknowledgeCctvEventDto,
  CreateIncidentFromEventDto,
} from '../presentation/dto/device.dto';

/**
 * Module 28-A — CCTV alert triage. Operators acknowledge AI alerts or record
 * an incident from a camera event (metadata only — video stays on NVR).
 * Incident creation goes through IncidentsService (module port, no cross-lib
 * repository access); site ABAC is enforced by that service.
 */
@Injectable()
export class CctvTriageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly incidents: IncidentsService,
  ) {}

  async acknowledgeEvent(
    id: string,
    dto: AcknowledgeCctvEventDto,
    user: AuthUser,
  ) {
    const event = await this.findTriagableEvent(id, user);

    const updated = await this.prisma.deviceEvent.update({
      where: { id: event.id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        routedTo: 'acknowledged',
      },
      include: {
        device: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'cctv.event.acknowledged',
      resourceType: 'DeviceEvent',
      resourceId: event.id,
      before: { status: event.status },
      after: { status: updated.status, note: dto.note ?? null },
    });

    return updated;
  }

  async createIncidentFromEvent(
    id: string,
    dto: CreateIncidentFromEventDto,
    user: AuthUser,
  ) {
    const event = await this.findTriagableEvent(id, user);

    const device = await this.prisma.device.findFirst({
      where: { id: event.deviceId, organizationId: user.organizationId },
    });
    if (!device) throw new NotFoundException('Camera not found');
    if (!device.siteId) {
      throw new BadRequestException({
        error: 'DEVICE_SITE_REQUIRED',
        message:
          'Camera has no site assigned — set the device site before recording an incident',
      });
    }

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const payloadTitle = this.firstString(payload, [
      'title',
      'message',
      'alert',
      'label',
      'summary',
    ]);

    // IncidentsService dedupes on clientEventId — replay returns the same incident.
    const incident = await this.incidents.create(
      {
        siteId: device.siteId,
        category: 'CCTV_ALERT',
        title: dto.title?.trim() || payloadTitle || `CCTV alert — ${device.code}`,
        description:
          dto.description?.trim() ||
          `Recorded from CCTV AI alert on camera ${device.code} (${device.name}). ` +
            `Event captured ${event.capturedAt.toISOString()}. ` +
            `Payload: ${JSON.stringify(payload).slice(0, 800)}`,
        severity: dto.severity ?? this.mapSeverity(payload),
        deviceReportedAt: event.capturedAt.toISOString(),
        clientEventId: `device-event:${event.id}`,
      },
      user,
    );

    const updated = await this.prisma.deviceEvent.update({
      where: { id: event.id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        routedTo: 'incidents',
      },
      include: {
        device: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'cctv.event.incident_created',
      resourceType: 'DeviceEvent',
      resourceId: event.id,
      after: {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
      },
    });

    return { incident, event: updated };
  }

  /** Org-scoped CCTV_EVENT still open for triage (RECEIVED / FAILED). */
  private async findTriagableEvent(id: string, user: AuthUser) {
    const event = await this.prisma.deviceEvent.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!event) throw new NotFoundException('Device event not found');
    if (event.type !== DeviceEventType.CCTV_EVENT) {
      throw new ForbiddenException({
        error: 'CCTV_TRIAGE_SCOPE',
        message: 'Only CCTV_EVENT metadata can be triaged here',
      });
    }
    if (event.status === 'PROCESSED' || event.status === 'IGNORED') {
      throw new BadRequestException({
        error: 'EVENT_ALREADY_TRIAGED',
        message: `Event is already ${event.status}`,
      });
    }
    return event;
  }

  private firstString(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const k of keys) {
      const v = payload[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  }

  private mapSeverity(payload: Record<string, unknown>): IncidentSeverity {
    const raw = String(
      payload.severity ?? payload.level ?? payload.priority ?? '',
    ).toUpperCase();
    if (raw === 'CRITICAL' || raw === 'ALARM') return IncidentSeverity.CRITICAL;
    if (raw === 'HIGH') return IncidentSeverity.HIGH;
    if (raw === 'LOW' || raw === 'INFO') return IncidentSeverity.LOW;
    return IncidentSeverity.MEDIUM;
  }
}
