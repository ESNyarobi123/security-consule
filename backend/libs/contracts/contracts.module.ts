import { Module } from '@nestjs/common';
import { ApprovalsModule } from '@pssms/approvals';
import { AuditModule } from '@pssms/audit';
import { NotificationsModule } from '@pssms/notifications';
import { ContractsService } from './application/contracts.service';
import { ContractsController } from './presentation/contracts.controller';

@Module({
  imports: [AuditModule, NotificationsModule, ApprovalsModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
