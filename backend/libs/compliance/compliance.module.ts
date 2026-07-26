import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import { ComplianceService } from './application/compliance.service';
import { ComplianceController } from './presentation/compliance.controller';

@Module({
  imports: [AuditModule, ApprovalsModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
