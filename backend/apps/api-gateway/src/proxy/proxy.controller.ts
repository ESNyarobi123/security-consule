import { All, Controller, Req, Res } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('*')
  async proxy(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const pathOnly = (req.url ?? '').split('?')[0] ?? '';

    // Prefer dedicated HealthController; fallback if catch-all wins.
    if (
      req.method === 'GET' &&
      (pathOnly === '/api/v1/health' || pathOnly === '/health')
    ) {
      await reply.status(200).send({
        status: 'ok',
        service: 'api-gateway',
      });
      return;
    }

    await this.proxyService.forward(req, reply);
  }
}
