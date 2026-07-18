import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter, ResponseInterceptor } from '@pssms/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PSSMS Integration Gateway')
    .setDescription('Webhooks, adapters, internal dispatch — Phase 6')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Webhooks')
    .addTag('Webhooks — Admin')
    .addTag('Internal')
    .addTag('Health')
    .addTag('Providers')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.INTEGRATION_GATEWAY_PORT ?? 4003);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`integration-gateway listening on http://localhost:${port}`);
}

void bootstrap();
