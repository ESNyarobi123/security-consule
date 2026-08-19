import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ParkingModule } from '@pssms/parking';
import { AccessControlModule } from '@pssms/access-control';
import { VisitorsModule } from '@pssms/visitors';
import { AttendanceModule } from '@pssms/attendance';
import { IncidentsModule } from '@pssms/incidents';
import { DeviceRegistryService } from './application/device-registry.service';
import { DeviceIngestionService } from './application/device-ingestion.service';
import { DeviceCommandService } from './application/device-command.service';
import { CctvTriageService } from './application/cctv-triage.service';
import { CctvMonitoringService } from './application/cctv-monitoring.service';
import { DeviceAuthGuard } from './infrastructure/device-auth.guard';
import { DeviceController } from './presentation/device.controller';
import { DeviceApiController } from './presentation/device-api.controller';
import { CctvController } from './presentation/cctv.controller';

@Module({
  imports: [
    AuditModule,
    ParkingModule,
    AccessControlModule,
    VisitorsModule,
    AttendanceModule,
    IncidentsModule,
  ],
  controllers: [DeviceController, DeviceApiController, CctvController],
  providers: [
    DeviceRegistryService,
    DeviceIngestionService,
    DeviceCommandService,
    CctvTriageService,
    CctvMonitoringService,
    DeviceAuthGuard,
  ],
  exports: [DeviceRegistryService, DeviceIngestionService, DeviceCommandService],
})
export class DevicesModule {}
