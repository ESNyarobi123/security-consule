import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        code = HttpStatus[status] ?? 'HTTP_ERROR';
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        message = (obj.message as string) ?? message;
        const rawError = obj.error;
        // Prefer app codes (e.g. MFA_REQUIRED). Nest defaults are prose titles.
        if (
          typeof rawError === 'string' &&
          /^[A-Z][A-Z0-9_]+$/.test(rawError)
        ) {
          code = rawError;
        } else if (typeof rawError === 'string') {
          code = rawError;
        }
        if (Array.isArray(obj.message)) {
          details = obj.message;
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
        }
      }
      // Nest often returns error: "Unauthorized" — normalize only generic titles.
      if (
        status === HttpStatus.UNAUTHORIZED &&
        !/^[A-Z][A-Z0-9_]+$/.test(code)
      ) {
        code = 'UNAUTHORIZED';
      } else if (
        status === HttpStatus.FORBIDDEN &&
        !/^[A-Z][A-Z0-9_]+$/.test(code)
      ) {
        code = 'FORBIDDEN';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    void response.status(status).send({
      success: false,
      error: { code, message, details },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
