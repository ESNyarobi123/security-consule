import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from '@pssms/shared';
import { AuditModule } from '@pssms/audit';
import { IdentityModule } from '@pssms/identity';
import { ReportingModule } from '@pssms/reporting';
import { HealthController } from './health.controller';
import { InternalController } from './internal.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '../../../../.env'),
        join(process.cwd(), '../.env'),
        join(process.cwd(), '.env'),
      ],
    }),
    PrismaModule,
    AuditModule,
    IdentityModule,
    ReportingModule,
  ],
  controllers: [HealthController, InternalController],
})
export class AppModule {}
