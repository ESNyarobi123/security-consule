import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { ContractsService } from './application/contracts.service';
import { ContractsController } from './presentation/contracts.controller';

@Module({
  imports: [AuditModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
