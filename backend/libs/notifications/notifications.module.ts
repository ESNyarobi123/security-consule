import { Module } from '@nestjs/common';
import { NotificationsService } from './application/notifications.service';
import { OutboxWriterService } from './application/outbox-writer.service';
import { NotificationsController } from './presentation/notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, OutboxWriterService],
  exports: [NotificationsService, OutboxWriterService],
})
export class NotificationsModule {}
