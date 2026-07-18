import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@pssms/shared';
import { IdentityModule } from '@pssms/identity';
import { EnterpriseModule } from '@pssms/enterprise';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import { CustomersModule } from '@pssms/customers';
import { ContractsModule } from '@pssms/contracts';
import { WorkforceModule } from '@pssms/workforce';
import { OperationsModule } from '@pssms/operations';
import { AttendanceModule } from '@pssms/attendance';
import { OccurrenceBookModule } from '@pssms/occurrence-book';
import { IncidentsModule } from '@pssms/incidents';
import { AccessControlModule } from '@pssms/access-control';
import { VisitorsModule } from '@pssms/visitors';
import { ParkingModule } from '@pssms/parking';
import { RecruitmentModule } from '@pssms/recruitment';
import { PayrollModule } from '@pssms/payroll';
import { EmployeeLoansModule } from '@pssms/employee-loans';
import { FinanceModule } from '@pssms/finance';
import { ProcurementModule } from '@pssms/procurement';
import { InventoryModule } from '@pssms/inventory';
import { AssetsModule } from '@pssms/assets';
import { NotificationsModule } from '@pssms/notifications';
import { DevicesModule } from '@pssms/devices';
import { HealthController } from './health.controller';
import { InternalController } from './internal.controller';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '../../../../.env'),
        join(process.cwd(), '../.env'),
        join(process.cwd(), '.env'),
      ],
    }),
    PrismaModule,
    AuditModule,
    IdentityModule,
    EnterpriseModule,
    ApprovalsModule,
    CustomersModule,
    ContractsModule,
    WorkforceModule,
    OperationsModule,
    AttendanceModule,
    OccurrenceBookModule,
    IncidentsModule,
    AccessControlModule,
    VisitorsModule,
    ParkingModule,
    RecruitmentModule,
    PayrollModule,
    EmployeeLoansModule,
    FinanceModule,
    ProcurementModule,
    InventoryModule,
    AssetsModule,
    NotificationsModule,
    DevicesModule,
  ],
  controllers: [HealthController, InternalController],
})
export class AppModule {}
