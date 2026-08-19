import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import { NotificationsModule } from '@pssms/notifications';
import { InvoicesService } from './application/invoices.service';
import { FinanceOpsService } from './application/finance-ops.service';
import {
  InvoicesController,
  PaymentVouchersController,
  PettyCashController,
  FinanceReportsController,
} from './presentation/finance.controller';

@Module({
  imports: [AuditModule, ApprovalsModule, NotificationsModule],
  controllers: [
    InvoicesController,
    PettyCashController,
    PaymentVouchersController,
    FinanceReportsController,
  ],
  providers: [InvoicesService, FinanceOpsService],
  exports: [InvoicesService, FinanceOpsService],
})
export class FinanceModule {}
