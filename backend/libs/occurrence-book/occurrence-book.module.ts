import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { OccurrenceService } from './application/occurrence.service';
import { OccurrenceController } from './presentation/occurrence.controller';

@Module({
  imports: [AuditModule],
  controllers: [OccurrenceController],
  providers: [OccurrenceService],
  exports: [OccurrenceService],
})
export class OccurrenceBookModule {}
