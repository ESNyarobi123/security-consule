import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { IncidentsService } from './application/incidents.service';
import { IncidentsController } from './presentation/incidents.controller';

@Module({
  imports: [AuditModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
