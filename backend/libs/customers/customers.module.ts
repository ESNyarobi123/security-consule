import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { CustomersService } from './application/customers.service';
import { CustomersController } from './presentation/customers.controller';

@Module({
  imports: [AuditModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
