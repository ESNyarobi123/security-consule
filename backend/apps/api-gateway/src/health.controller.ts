import { Controller, Get, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';

@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  health(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const requestId =
      typeof req.headers['x-request-id'] === 'string' &&
      req.headers['x-request-id'].length > 0
        ? req.headers['x-request-id']
        : randomUUID();
    reply.header('x-request-id', requestId);
    return {
      status: 'ok',
      service: 'api-gateway',
    };
  }
}
