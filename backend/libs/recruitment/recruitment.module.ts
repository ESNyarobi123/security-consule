import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { WorkforceModule } from '@pssms/workforce';
import { RecruitmentService } from './application/recruitment.service';
import { RecruitmentController } from './presentation/recruitment.controller';

@Module({
  imports: [AuditModule, WorkforceModule],
  controllers: [RecruitmentController],
  providers: [RecruitmentService],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}
