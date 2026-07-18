import { Global, Module } from '@nestjs/common';
import { PrismaService, createRlsPrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => createRlsPrismaService(),
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
