import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import { GuardsService } from './application/guards.service';
import { EmployeesService } from './application/employees.service';
import { LeaveService } from './application/leave.service';
import { SalaryService } from './application/salary.service';
import { GuardsController } from './presentation/guards.controller';
import {
  EmployeesController,
  LeaveController,
  SalaryController,
} from './presentation/hr.controller';

@Module({
  imports: [AuditModule, ApprovalsModule],
  controllers: [
    GuardsController,
    EmployeesController,
    LeaveController,
    SalaryController,
  ],
  providers: [
    GuardsService,
    EmployeesService,
    LeaveService,
    SalaryService,
  ],
  exports: [GuardsService, EmployeesService, SalaryService],
})
export class WorkforceModule {}
