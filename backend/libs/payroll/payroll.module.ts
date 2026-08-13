import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import { WorkforceModule } from '@pssms/workforce';
import { EmployeeLoansModule } from '@pssms/employee-loans';
import { NotificationsModule } from '@pssms/notifications';
import { CustomerSalaryService } from './application/customer-salary.service';
import { PayrollDueService } from './application/payroll-due.service';
import { PayrollService } from './application/payroll.service';
import { PayrollController } from './presentation/payroll.controller';

@Module({
  imports: [
    AuditModule,
    ApprovalsModule,
    WorkforceModule,
    EmployeeLoansModule,
    NotificationsModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService, CustomerSalaryService, PayrollDueService],
  exports: [PayrollService, CustomerSalaryService, PayrollDueService],
})
export class PayrollModule {}
