import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.GATEWAY_THROTTLE_TTL ?? 60_000),
        limit: Number(process.env.GATEWAY_THROTTLE_LIMIT ?? 120),
      },
    ]),
    ProxyModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
