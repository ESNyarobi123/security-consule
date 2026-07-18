import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { AccessControlService } from './application/access-control.service';
import { AccessControlController } from './presentation/access-control.controller';

@Module({
  imports: [AuditModule],
  controllers: [AccessControlController],
  providers: [AccessControlService],
  exports: [AccessControlService],
})
export class AccessControlModule {}
