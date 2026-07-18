import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsService } from './application/approvals.service';
import { ApprovalsController } from './presentation/approvals.controller';

@Module({
  imports: [AuditModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
