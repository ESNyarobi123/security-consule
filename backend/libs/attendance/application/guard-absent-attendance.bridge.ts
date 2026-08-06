import { Injectable, OnModuleInit } from '@nestjs/common';
import { GuardsService } from '@pssms/workforce';
import { AlertnessService } from './alertness.service';
import { AttendanceService } from './attendance.service';

/**
 * Module 8-E/F — registers ABSENT duty cleanup on GuardsService without a Nest
 * cycle (AttendanceModule → WorkforceModule only).
 */
@Injectable()
export class GuardAbsentAttendanceBridge implements OnModuleInit {
  constructor(
    private readonly guards: GuardsService,
    private readonly attendance: AttendanceService,
    private readonly alertness: AlertnessService,
  ) {}

  onModuleInit(): void {
    this.guards.registerAbsentDutyCleanup(async (guardId, user, meta) => {
      const closed = await this.attendance.closeOpenForGuardAbsent(
        guardId,
        user,
        meta,
      );
      const cancelled = await this.alertness.cancelScheduledForGuardAbsent(
        guardId,
        user,
        meta,
      );
      return {
        closedIds: closed.closedIds,
        cancelledAlertnessIds: cancelled.cancelledIds,
      };
    });
  }
}
