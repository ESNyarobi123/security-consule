import { Module } from '@nestjs/common';
import {
  DevPublishController,
  EventsSseController,
  HealthController,
} from './events-sse.controller';

@Module({
  controllers: [EventsSseController, HealthController, DevPublishController],
})
export class AppModule {}
