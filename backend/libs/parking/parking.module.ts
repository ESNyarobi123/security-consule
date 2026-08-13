import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { FinanceModule } from '@pssms/finance';
import { NotificationsModule } from '@pssms/notifications';
import { ParkingReportsService } from './application/parking-reports.service';
import { ParkingService } from './application/parking.service';
import { ParkingController } from './presentation/parking.controller';

@Module({
  imports: [AuditModule, FinanceModule, NotificationsModule],
  controllers: [ParkingController],
  providers: [ParkingService, ParkingReportsService],
  exports: [ParkingService, ParkingReportsService],
})
export class ParkingModule {}
