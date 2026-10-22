import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeviceEventType, IncidentSeverity } from '@prisma/client';
import { PrismaService, AuthUser, assertSiteAccess } from '@pssms/shared';
import { AuditService } from '@pssms/audit';
import { IncidentsService } from '@pssms/incidents';
import {
  AcknowledgeCctvEventDto,
  CreateIncidentFromEventDto,
} from '../presentation/dto/device.dto';
import {
  detectionLabel,
  detectionTypeFromPayload,
  deriveSeverityFromPayload,
  pickNumber,
  pickString,
} from './cctv-alert.util';

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
    const { event } = await this.findTriagableEvent(id, user);

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
    const { event } = await this.findTriagableEvent(id, user);

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
    const detectionType = detectionTypeFromPayload(payload);
    const label = detectionLabel(detectionType);
    const confidence = pickNumber(payload, [
      'confidence',
      'score',
      'probability',
      'accuracy',
    ]);
    const zone =
      pickString(payload, ['zone', 'area', 'region', 'checkpoint']) ??
      this.configString(device.config, 'zone');
    const snapshotUrl = pickString(payload, [
      'snapshot_url',
      'snapshotUrl',
      'imageUrl',
      'image_url',
      'snapshot',
    ]);
    const site = await this.prisma.site.findFirst({
      where: { id: device.siteId, organizationId: user.organizationId },
      select: { code: true, name: true },
    });

    const description =
      dto.description?.trim() ||
      [
        `AI alert: ${label} (${detectionType}).`,
        `Camera: ${device.name} (${device.code})${device.vendor ? ` · ${device.vendor}` : ''}.`,
        `Site: ${site ? `${site.code} — ${site.name}` : device.siteId}.`,
        zone ? `Zone: ${zone}.` : null,
        confidence != null
          ? `Detection confidence: ${Math.round((confidence > 1 ? confidence : confidence * 100))}%.`
          : null,
        snapshotUrl ? `Snapshot: ${snapshotUrl}` : null,
        `Captured at: ${event.capturedAt.toISOString()}.`,
        `Raw payload: ${JSON.stringify(payload).slice(0, 600)}`,
      ]
        .filter(Boolean)
        .join('\n');

    // IncidentsService dedupes on clientEventId — replay returns the same incident.
    const incident = await this.incidents.create(
      {
        siteId: device.siteId,
        category: 'CCTV_ALERT',
        title:
          dto.title?.trim() ||
          `${label} — ${device.name} (${device.code})`.slice(0, 200),
        description: description.slice(0, 5000),
        severity: dto.severity ?? this.mapSeverity(payload),
        locationDescription: (zone ? `${site?.name ?? 'Site'} · ${zone}` : site?.name)?.slice(
          0,
          300,
        ),
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

  private configString(config: unknown, key: string): string | undefined {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return undefined;
    }
    const v = (config as Record<string, unknown>)[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  }

  /** Org-scoped CCTV_EVENT still open for triage (RECEIVED / FAILED). */
  private async findTriagableEvent(id: string, user: AuthUser) {
    const event = await this.prisma.deviceEvent.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { device: { select: { siteId: true } } },
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
    // Supervisors are site-scoped; Control Room / Ops Mgr / CCTV Operator are org-wide.
    if (event.device?.siteId) assertSiteAccess(user, event.device.siteId);
    return { event, device: event.device };
  }

  private mapSeverity(payload: Record<string, unknown>): IncidentSeverity {
    const raw = deriveSeverityFromPayload(payload);
    if (raw === 'CRITICAL' || raw === 'ALARM') return IncidentSeverity.CRITICAL;
    if (raw === 'HIGH') return IncidentSeverity.HIGH;
    if (raw === 'LOW' || raw === 'INFO') return IncidentSeverity.LOW;
    return IncidentSeverity.MEDIUM;
  }
}
