import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import { AssetsModule } from '@pssms/assets';
import { FinanceModule } from '@pssms/finance';
import { OperationsModule } from '@pssms/operations';
import { GuardsService } from './application/guards.service';
import { EmployeesService } from './application/employees.service';
import { BranchStaffService } from './application/branch-staff.service';
import { LeaveService } from './application/leave.service';
import { SalaryService } from './application/salary.service';
import { TrainingService } from './application/training.service';
import { DisciplineService } from './application/discipline.service';
import { MovementService } from './application/movement.service';
import { EssService } from './application/ess.service';
import { SelfEmployeeService } from './application/self-employee.service';
import { GuardsController } from './presentation/guards.controller';
import {
  EmployeesController,
  LeaveController,
  SalaryController,
  TrainingController,
  DisciplineController,
  MovementsController,
} from './presentation/hr.controller';
import { BranchStaffController } from './presentation/branch-staff.controller';
import { EssController } from './presentation/ess.controller';

@Module({
  imports: [
    AuditModule,
    ApprovalsModule,
    AssetsModule,
    FinanceModule,
    OperationsModule,
  ],
  controllers: [
    GuardsController,
    EmployeesController,
    LeaveController,
    SalaryController,
    TrainingController,
    DisciplineController,
    MovementsController,
    EssController,
    BranchStaffController,
  ],
  providers: [
    GuardsService,
    EmployeesService,
    LeaveService,
    SalaryService,
    TrainingService,
    DisciplineService,
    MovementService,
    EssService,
    SelfEmployeeService,
    BranchStaffService,
  ],
  exports: [
    GuardsService,
    EmployeesService,
    LeaveService,
    SalaryService,
    EssService,
    SelfEmployeeService,
  ],
})
export class WorkforceModule {}
