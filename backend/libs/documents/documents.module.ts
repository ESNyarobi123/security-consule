import { Module } from '@nestjs/common';
import { AuditModule } from '@pssms/audit';
import { DocumentsService } from './application/documents.service';
import { MinioStorageService } from './infrastructure/minio-storage.service';
import { DocumentsController } from './presentation/documents.controller';

@Module({
  imports: [AuditModule],
  controllers: [DocumentsController],
  providers: [MinioStorageService, DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
