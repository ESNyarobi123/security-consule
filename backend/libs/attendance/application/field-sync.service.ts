import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthUser } from '@pssms/shared';
import { AttendanceService } from './attendance.service';
import { AlertnessService } from './alertness.service';
import { PatrolService } from './patrol.service';
import { IncidentsService } from '@pssms/incidents';
import { INCIDENT_CATEGORIES } from '@pssms/incidents/presentation/dto/incident.dto';
import { GuardsService } from '@pssms/workforce';
import {
  FieldSyncBatchDto,
  FieldSyncResultDto,
} from '../presentation/dto/attendance.dto';
import { AttendanceMethod, IncidentSeverity } from '@prisma/client';

@Injectable()
export class FieldSyncService {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly alertness: AlertnessService,
    private readonly patrol: PatrolService,
    private readonly incidents: IncidentsService,
    private readonly guards: GuardsService,
  ) {}

  async syncBatch(
    dto: FieldSyncBatchDto,
    user: AuthUser,
  ): Promise<FieldSyncResultDto[]> {
    const results: FieldSyncResultDto[] = [];

    for (const event of dto.events) {
      try {
        switch (event.type) {
          case 'CLOCK_IN': {
            const p = event.payload as {
              siteId: string;
              shiftId?: string;
              method?: AttendanceMethod;
              gps: { latitude: number; longitude: number };
            };
            const res = await this.attendance.clockIn(
              {
                siteId: p.siteId,
                shiftId: p.shiftId,
                method: p.method ?? AttendanceMethod.MOBILE_GPS,
                gps: p.gps,
                deviceTime: event.deviceTime,
                clientEventId: event.clientEventId,
              },
              user,
            );
            results.push({
              clientEventId: event.clientEventId,
              status: 'ACCEPTED',
              serverId: res.id,
            });
            break;
          }
          case 'CLOCK_OUT': {
            const p = event.payload as {
              attendanceId: string;
              method?: AttendanceMethod;
              gps: { latitude: number; longitude: number };
            };
            const res = await this.attendance.clockOut(
              {
                attendanceId: p.attendanceId,
                method: p.method ?? AttendanceMethod.MOBILE_GPS,
                gps: p.gps,
                deviceTime: event.deviceTime,
                clientEventId: event.clientEventId,
              },
              user,
            );
            results.push({
              clientEventId: event.clientEventId,
              status: 'ACCEPTED',
              serverId: res.id,
            });
            break;
          }
          case 'ALERTNESS_CONFIRM': {
            const p = event.payload as {
              alertnessCheckId: string;
              method: AttendanceMethod;
              gps: { latitude: number; longitude: number };
            };
            const res = await this.alertness.confirm(
              {
                alertnessCheckId: p.alertnessCheckId,
                method: p.method,
                gps: p.gps,
                deviceTime: event.deviceTime,
                clientEventId: event.clientEventId,
              },
              user,
            );
            results.push({
              clientEventId: event.clientEventId,
              status: 'ACCEPTED',
              serverId: res.id,
            });
            break;
          }
          case 'PATROL_SCAN': {
            const p = event.payload as {
              siteId: string;
              checkpointId: string;
              routeId?: string;
              method: AttendanceMethod;
              gps: { latitude: number; longitude: number };
              qrOrNfcCode?: string;
            };
            const res = await this.patrol.scan(
              {
                siteId: p.siteId,
                checkpointId: p.checkpointId,
                routeId: p.routeId,
                method: p.method,
                gps: p.gps,
                deviceTime: event.deviceTime,
                clientEventId: event.clientEventId,
                qrOrNfcCode: p.qrOrNfcCode,
              },
              user,
            );
            results.push({
              clientEventId: event.clientEventId,
              status: 'ACCEPTED',
              serverId: res.id,
            });
            break;
          }
          case 'PATROL_ISSUE': {
            const p = event.payload as {
              siteId: string;
              routeId: string;
              checkpointId?: string;
              title: string;
              description: string;
              severity: IncidentSeverity;
              gps: { latitude: number; longitude: number };
            };
            const res = await this.patrol.reportIssue(
              {
                siteId: p.siteId,
                routeId: p.routeId,
                checkpointId: p.checkpointId,
                title: p.title,
                description: p.description,
                severity: p.severity,
                gps: p.gps,
                deviceTime: event.deviceTime,
                clientEventId: event.clientEventId,
              },
              user,
            );
            results.push({
              clientEventId: event.clientEventId,
              status: 'ACCEPTED',
              serverId: res.id,
            });
            break;
          }
          case 'INCIDENT': {
            if (
              !user.permissions.includes('incidents.manage') &&
              !user.permissions.includes('attendance.manage')
            ) {
              throw new ForbiddenException({
                error: 'FORBIDDEN',
                message: 'Missing incidents.manage or attendance.manage',
              });
            }
            const guard = await this.guards.getByUserId(
              user.id,
              user.organizationId,
            );
            if (!guard) {
              throw new BadRequestException('User is not a registered guard');
            }
            const p = event.payload as {
              siteId: string;
              category: string;
              title: string;
              description: string;
              severity: IncidentSeverity;
              gps?: { latitude: number; longitude: number };
            };
            if (
              !INCIDENT_CATEGORIES.includes(
                p.category as (typeof INCIDENT_CATEGORIES)[number],
              )
            ) {
              throw new BadRequestException({
                error: 'INVALID_INCIDENT_CATEGORY',
                message: 'Incident category is not in the catalog',
              });
            }
            const res = await this.incidents.create(
              {
                siteId: p.siteId,
                category: p.category,
                title: p.title,
                description: p.description,
                severity: p.severity,
                latitude: p.gps?.latitude,
                longitude: p.gps?.longitude,
                deviceReportedAt: event.deviceTime,
                clientEventId: event.clientEventId,
              },
              user,
            );
            results.push({
              clientEventId: event.clientEventId,
              status: 'ACCEPTED',
              serverId: res.id,
            });
            break;
          }
          default:
            results.push({
              clientEventId: event.clientEventId,
              status: 'REJECTED',
              message: `Unknown event type: ${event.type}`,
            });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        const isDup = msg.toLowerCase().includes('unique');
        results.push({
          clientEventId: event.clientEventId,
          status: isDup ? 'DUPLICATE' : 'REJECTED',
          message: msg,
        });
      }
    }

    return results;
  }
}
