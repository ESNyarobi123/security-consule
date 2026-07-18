import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { NotificationsModule } from '@pssms/notifications';
import { VisitorsService } from './application/visitors.service';
import { VisitorsController } from './presentation/visitors.controller';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [VisitorsController],
  providers: [VisitorsService],
  exports: [VisitorsService],
})
export class VisitorsModule {}
