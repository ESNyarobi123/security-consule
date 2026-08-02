import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { NotificationsModule } from '@pssms/notifications';
import { CustomersService } from './application/customers.service';
import { CustomerPortalOpsService } from './application/customer-portal-ops.service';
import { CustomerPortalUsersService } from './application/customer-portal-users.service';
import { CustomerServiceRequestsService } from './application/customer-service-requests.service';
import { CustomersController } from './presentation/customers.controller';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CustomerPortalOpsService,
    CustomerPortalUsersService,
    CustomerServiceRequestsService,
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
