import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { FinanceModule } from '@pssms/finance';
import { ParkingService } from './application/parking.service';
import { ParkingController } from './presentation/parking.controller';

@Module({
  imports: [AuditModule, FinanceModule],
  controllers: [ParkingController],
  providers: [ParkingService],
  exports: [ParkingService],
})
export class ParkingModule {}
