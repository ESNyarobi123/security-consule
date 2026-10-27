import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';

function humanizeCode(code: string): string {
  const text = code.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** App codes are SCREAMING_SNAKE_CASE; Nest defaults are prose ("Not Found"). */
const APP_CODE = /^[A-Z][A-Z0-9_]+$/;

/**
 * Canonical fallback code per HTTP status. Without this, a Nest
 * `UnauthorizedException()` (passport guard: `{ message: 'Unauthorized',
 * statusCode: 401 }` — no `error` field) kept the initial `INTERNAL_ERROR`
 * label, so expired sessions surfaced as scary 500-looking failures in every
 * portal instead of a clean `UNAUTHORIZED`.
 */
const STATUS_CODES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.NOT_IMPLEMENTED]: 'NOT_IMPLEMENTED',
  [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  [HttpStatus.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
};

const UNAUTHORIZED_MESSAGE =
  'Your session has expired — please sign in again.';

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
      const fallbackCode = STATUS_CODES[status] ?? 'HTTP_ERROR';
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        code = fallbackCode;
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        if (typeof obj.message === 'string') {
          message = obj.message;
        }
        const rawError = obj.error;
        // Prefer app codes (e.g. MFA_REQUIRED, CREATOR_CANNOT_APPROVE). Nest
        // default titles ("Unauthorized") are prose, so use the status code.
        code =
          typeof rawError === 'string' && APP_CODE.test(rawError)
            ? rawError
            : fallbackCode;
        if (Array.isArray(obj.message)) {
          details = obj.message;
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
        }
        // Many services throw `{ error: 'APP_CODE' }` with no message.
        // Surface a readable message instead of a scary generic 500 text.
        if (message === 'Internal server error' && typeof rawError === 'string') {
          message = humanizeCode(code);
        }
      }
      // An expired/invalid token is an auth problem, not a server fault.
      if (status === HttpStatus.UNAUTHORIZED && message === 'Unauthorized') {
        message = UNAUTHORIZED_MESSAGE;
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
