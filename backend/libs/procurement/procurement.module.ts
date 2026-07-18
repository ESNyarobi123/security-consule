import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import {
  PurchaseOrdersService,
  SuppliersService,
} from './application/procurement.service';
import {
  PurchaseOrdersController,
  SuppliersController,
} from './presentation/procurement.controller';

@Module({
  imports: [AuditModule, ApprovalsModule],
  controllers: [SuppliersController, PurchaseOrdersController],
  providers: [SuppliersService, PurchaseOrdersService],
  exports: [SuppliersService, PurchaseOrdersService],
})
export class ProcurementModule {}
