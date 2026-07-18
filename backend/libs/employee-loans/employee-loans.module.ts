import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import { WorkforceModule } from '@pssms/workforce';
import { EmployeeLoansService } from './application/employee-loans.service';
import { EmployeeLoansController } from './presentation/employee-loans.controller';

@Module({
  imports: [AuditModule, ApprovalsModule, WorkforceModule],
  controllers: [EmployeeLoansController],
  providers: [EmployeeLoansService],
  exports: [EmployeeLoansService],
})
export class EmployeeLoansModule {}
