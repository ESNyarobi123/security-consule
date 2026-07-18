import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import { WorkforceModule } from '@pssms/workforce';
import { EmployeeLoansModule } from '@pssms/employee-loans';
import { PayrollService } from './application/payroll.service';
import { PayrollController } from './presentation/payroll.controller';

@Module({
  imports: [AuditModule, ApprovalsModule, WorkforceModule, EmployeeLoansModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
