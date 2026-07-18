import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { AssetsService } from './application/assets.service';
import { AssetsController } from './presentation/assets.controller';

@Module({
  imports: [AuditModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
