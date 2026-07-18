import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PSSMS Realtime Gateway')
    .setDescription('SSE event stream — Phase 6')
    .setVersion('0.1.0')
    .addTag('Realtime')
    .addTag('Health')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.REALTIME_GATEWAY_PORT ?? 4004);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`realtime-gateway listening on http://localhost:${port}`);
}

void bootstrap();
