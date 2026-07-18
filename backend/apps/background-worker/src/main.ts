import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const port = Number(process.env.BACKGROUND_WORKER_PORT ?? 4002);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`background-worker listening on http://localhost:${port}`);
}

void bootstrap();
