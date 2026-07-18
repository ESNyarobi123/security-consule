import { Injectable } from '@nestjs/common';
import { AuthUser } from '@pssms/shared';
import { AttendanceService } from './attendance.service';
import { AlertnessService } from './alertness.service';
import { PatrolService } from './patrol.service';
import {
  FieldSyncBatchDto,
  FieldSyncResultDto,
} from '../presentation/dto/attendance.dto';
import { AttendanceMethod } from '@prisma/client';

@Injectable()
export class FieldSyncService {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly alertness: AlertnessService,
    private readonly patrol: PatrolService,
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
