import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { WorkforceModule } from '@pssms/workforce';
import { NotificationsModule } from '@pssms/notifications';
import { AttendanceService } from './application/attendance.service';
import { AlertnessService } from './application/alertness.service';
import { PatrolService } from './application/patrol.service';
import { FieldSyncService } from './application/field-sync.service';
import { FieldAlertsService } from './application/field-alerts.service';
import { AttendanceController } from './presentation/attendance.controller';
import { AlertnessController } from './presentation/alertness.controller';
import { PatrolController } from './presentation/patrol.controller';
import { FieldSyncController } from './presentation/field-sync.controller';
import { FieldAlertsController } from './presentation/field-alerts.controller';

@Module({
  imports: [AuditModule, WorkforceModule, NotificationsModule],
  controllers: [
    AttendanceController,
    AlertnessController,
    PatrolController,
    FieldSyncController,
    FieldAlertsController,
  ],
  providers: [
    AttendanceService,
    AlertnessService,
    PatrolService,
    FieldSyncService,
    FieldAlertsService,
  ],
  exports: [
    AttendanceService,
    AlertnessService,
    PatrolService,
    FieldAlertsService,
  ],
})
export class AttendanceModule {}
