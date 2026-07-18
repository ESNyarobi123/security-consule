import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { InventoryService } from './application/inventory.service';
import { InventoryController } from './presentation/inventory.controller';

@Module({
  imports: [AuditModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
