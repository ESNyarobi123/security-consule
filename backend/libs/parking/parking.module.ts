import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ParkingService } from './application/parking.service';
import { ParkingController } from './presentation/parking.controller';

@Module({
  imports: [AuditModule],
  controllers: [ParkingController],
  providers: [ParkingService],
  exports: [ParkingService],
})
export class ParkingModule {}
