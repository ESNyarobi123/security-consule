import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ShiftsService } from './application/shifts.service';
import { CheckpointsService } from './application/checkpoints.service';
import { DeploymentsService } from './application/deployments.service';
import { ShiftsController } from './presentation/shifts.controller';
import { CheckpointsController } from './presentation/checkpoints.controller';
import { DeploymentsController } from './presentation/deployments.controller';

@Module({
  imports: [AuditModule],
  controllers: [ShiftsController, CheckpointsController, DeploymentsController],
  providers: [ShiftsService, CheckpointsService, DeploymentsService],
  exports: [ShiftsService, CheckpointsService, DeploymentsService],
})
export class OperationsModule {}
