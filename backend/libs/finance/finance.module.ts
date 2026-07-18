import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import { InvoicesService } from './application/invoices.service';
import { FinanceOpsService } from './application/finance-ops.service';
import {
  InvoicesController,
  PaymentVouchersController,
  PettyCashController,
} from './presentation/finance.controller';

@Module({
  imports: [AuditModule, ApprovalsModule],
  controllers: [
    InvoicesController,
    PettyCashController,
    PaymentVouchersController,
  ],
  providers: [InvoicesService, FinanceOpsService],
  exports: [InvoicesService, FinanceOpsService],
})
export class FinanceModule {}
