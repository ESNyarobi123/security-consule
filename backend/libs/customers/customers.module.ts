import { Module } from '@nestjs/common';
import { AccessControlModule } from '@pssms/access-control';
import { AuditModule } from '@pssms/audit';
import { EnterpriseModule } from '@pssms/enterprise';
import { NotificationsModule } from '@pssms/notifications';
import { PayrollModule } from '@pssms/payroll';
import { CustomersService } from './application/customers.service';
import { CustomerComplaintsService } from './application/customer-complaints.service';
import { CustomerContactsService } from './application/customer-contacts.service';
import { CustomerEmployeePortalService } from './application/customer-employee-portal.service';
import { CustomerOverviewService } from './application/customer-overview.service';
import { CustomerPortalOpsService } from './application/customer-portal-ops.service';
import { CustomerPortalUsersService } from './application/customer-portal-users.service';
import { CustomerReportsService } from './application/customer-reports.service';
import { CustomerServiceRequestsService } from './application/customer-service-requests.service';
import { CustomersController } from './presentation/customers.controller';

@Module({
  imports: [
    AuditModule,
    NotificationsModule,
    EnterpriseModule,
    AccessControlModule,
    PayrollModule,
  ],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CustomerOverviewService,
    CustomerReportsService,
    CustomerComplaintsService,
    CustomerContactsService,
    CustomerPortalOpsService,
    CustomerPortalUsersService,
    CustomerEmployeePortalService,
    CustomerServiceRequestsService,
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
