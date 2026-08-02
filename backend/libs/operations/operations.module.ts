import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { NotificationsModule } from '@pssms/notifications';
import { ShiftsService } from './application/shifts.service';
import { CheckpointsService } from './application/checkpoints.service';
import { PatrolRoutesService } from './application/patrol-routes.service';
import { DeploymentsService } from './application/deployments.service';
import { ShiftsController } from './presentation/shifts.controller';
import { CheckpointsController } from './presentation/checkpoints.controller';
import { PatrolRoutesController } from './presentation/patrol-routes.controller';
import { DeploymentsController } from './presentation/deployments.controller';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [
    ShiftsController,
    CheckpointsController,
    PatrolRoutesController,
    DeploymentsController,
  ],
  providers: [
    ShiftsService,
    CheckpointsService,
    PatrolRoutesService,
    DeploymentsService,
  ],
  exports: [
    ShiftsService,
    CheckpointsService,
    PatrolRoutesService,
    DeploymentsService,
  ],
})
export class OperationsModule {}
