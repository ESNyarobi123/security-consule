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
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PSSMS Reporting Service')
    .setDescription(
      'Executive analytics, KPI exports, and scheduled refresh — Phase 7c. Auth via Bearer JWT (login on core-api).',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Health')
    .addTag('Reporting')
    .addTag('Internal')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.REPORTING_SERVICE_PORT ?? 4005);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`reporting-service listening on http://localhost:${port}`);
}

void bootstrap();
