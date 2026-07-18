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
    .setTitle('PSSMS Core API')
    .setDescription(
      'HIGHLINK Private Security Services Management System — Phases 1–7 APIs. All authenticated endpoints require Bearer JWT. Responses use a standard envelope: { success, data, meta }.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Health')
    .addTag('Auth')
    .addTag('Users')
    .addTag('Enterprise')
    .addTag('Customers')
    .addTag('Contracts')
    .addTag('Approvals')
    .addTag('Audit')
    .addTag('Guards')
    .addTag('Operations')
    .addTag('Attendance')
    .addTag('Alertness')
    .addTag('Patrols')
    .addTag('Field Sync')
    .addTag('Occurrence Book')
    .addTag('Incidents')
    .addTag('Access Control')
    .addTag('Visitors')
    .addTag('Parking')
    .addTag('HR — Employees')
    .addTag('HR — Leave')
    .addTag('HR — Salary')
    .addTag('Recruitment')
    .addTag('Payroll')
    .addTag('Employee Loans')
    .addTag('Finance — Invoices')
    .addTag('Finance — Petty Cash')
    .addTag('Finance — Payment Vouchers')
    .addTag('Procurement — Suppliers')
    .addTag('Procurement — Purchase Orders')
    .addTag('Inventory')
    .addTag('Assets')
    .addTag('Notifications')
    .addTag('Internal')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });

  const port = Number(process.env.CORE_API_PORT ?? 4001);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`core-api listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs: http://localhost:${port}/docs`);
}

void bootstrap();
