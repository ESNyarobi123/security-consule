import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { WorkforceModule } from '@pssms/workforce';
import { RecruitmentService } from './application/recruitment.service';
import { RecruitmentB2bService } from './application/recruitment-b2b.service';
import { RecruitmentController } from './presentation/recruitment.controller';
import { RecruitmentB2bController } from './presentation/recruitment-b2b.controller';

@Module({
  imports: [AuditModule, WorkforceModule],
  controllers: [RecruitmentController, RecruitmentB2bController],
  providers: [RecruitmentService, RecruitmentB2bService],
  exports: [RecruitmentService, RecruitmentB2bService],
})
export class RecruitmentModule {}
