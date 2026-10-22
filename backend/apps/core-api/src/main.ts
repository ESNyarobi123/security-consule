import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import multipart from '@fastify/multipart';
import {
  HttpExceptionFilter,
  OrgContextInterceptor,
  PrismaService,
  ResponseInterceptor,
} from '@pssms/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // 5MB docs + multipart overhead (fields). Was 4MB — larger uploads
    // truncated parsing and surfaced as missing resourceType/resourceId.
    new FastifyAdapter({ logger: true, bodyLimit: 6 * 1024 * 1024 }),
  );

  // Action endpoints such as POST /procurement/purchase-orders/:id/submit,
  // /supplier-submissions/:id/approve, or /users/:id/mfa/reset take no body.
  // Browsers (and some proxies) still attach `Content-Type: application/json`
  // on such POSTs, and Fastify's default JSON parser then fails the request
  // with "Body cannot be empty when content-type is set to 'application/json'".
  // A no-body action is safe to treat as `{}`; real endpoints validate DTOs.
  // Nest's FastifyAdapter registers its own JSON parser during `init()`, so the
  // replacement happens after init (below) but before `listen()` boots Fastify.

  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
      fields: 10,
    },
  });

  app.setGlobalPrefix('api/v1');
  // Fastify @fastify/cors defaults to GET,HEAD,POST only — browsers then
  // block PATCH/PUT/DELETE (e.g. Apply roles) with opaque "Failed to fetch".
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Request-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // OrgContext must wrap ResponseInterceptor so the RLS transaction spans the handler.
  const prisma = app.get(PrismaService);
  app.useGlobalInterceptors(
    new OrgContextInterceptor(prisma),
    new ResponseInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      const raw = typeof body === 'string' ? body.trim() : '';
      if (!raw) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

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
    .addTag('Documents')
    .addTag('Notifications')
    .addTag('Devices')
    .addTag('Developer — Integrations')
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
