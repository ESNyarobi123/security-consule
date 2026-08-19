import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ApprovalsModule } from '@pssms/approvals';
import {
  PurchaseOrdersService,
  SuppliersService,
} from './application/procurement.service';
import { PurchaseRequestsService } from './application/purchase-requests.service';
import {
  PurchaseOrdersController,
  PurchaseRequestsController,
  ReceivingController,
  SupplierSubmissionsController,
  SuppliersController,
  ProcurementReportsController,
} from './presentation/procurement.controller';

@Module({
  imports: [AuditModule, ApprovalsModule],
  controllers: [
    SuppliersController,
    SupplierSubmissionsController,
    PurchaseOrdersController,
    PurchaseRequestsController,
    ReceivingController,
    ProcurementReportsController,
  ],
  providers: [SuppliersService, PurchaseOrdersService, PurchaseRequestsService],
  exports: [SuppliersService, PurchaseOrdersService, PurchaseRequestsService],
})
export class ProcurementModule {}
