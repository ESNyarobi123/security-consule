import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';

const FORWARD_HEADER_NAMES = [
  'authorization',
  'content-type',
  'accept',
  'x-request-id',
] as const;

@Injectable()
export class ProxyService {
  private coreApiBase(): string {
    return (
      process.env.CORE_API_URL ??
      process.env.CORE_API_INTERNAL_URL ??
      'http://127.0.0.1:4001'
    );
  }

  async forward(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const pathOnly = (req.url ?? '').split('?')[0] ?? '';

    if (pathOnly.includes('/internal')) {
      await reply.status(404).send({
        success: false,
        error: { message: 'Not Found' },
      });
      return;
    }

    const requestId =
      typeof req.headers['x-request-id'] === 'string' &&
      req.headers['x-request-id'].length > 0
        ? req.headers['x-request-id']
        : randomUUID();

    const headers: Record<string, string> = {
      'x-request-id': requestId,
    };

    for (const name of FORWARD_HEADER_NAMES) {
      if (name === 'x-request-id') continue;
      const value = req.headers[name];
      if (typeof value === 'string' && value.length > 0) {
        headers[name] = value;
      }
    }

    const method = (req.method ?? 'GET').toUpperCase();
    const targetUrl = `${this.coreApiBase().replace(/\/$/, '')}${req.url}`;

    const init: RequestInit = {
      method,
      headers,
    };

    if (method !== 'GET' && method !== 'HEAD' && req.body !== undefined) {
      if (typeof req.body === 'string') {
        init.body = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        init.body = new Uint8Array(req.body);
      } else {
        init.body = JSON.stringify(req.body);
        if (!headers['content-type']) {
          headers['content-type'] = 'application/json';
        }
      }
    }

    try {
      const upstream = await fetch(targetUrl, init);
      reply.header('x-request-id', requestId);

      const setCookies =
        typeof upstream.headers.getSetCookie === 'function'
          ? upstream.headers.getSetCookie()
          : [];
      if (setCookies.length > 0) {
        reply.header('set-cookie', setCookies);
      }

      const contentType = upstream.headers.get('content-type');
      if (contentType) {
        reply.header('content-type', contentType);
      }

      const text = await upstream.text();
      if (!text) {
        await reply.status(upstream.status).send();
        return;
      }

      if (contentType?.includes('application/json')) {
        try {
          await reply.status(upstream.status).send(JSON.parse(text) as unknown);
          return;
        } catch {
          // fall through with raw text
        }
      }

      await reply.status(upstream.status).send(text);
    } catch {
      reply.header('x-request-id', requestId);
      await reply.status(502).send({
        success: false,
        error: {
          message: 'Bad Gateway: upstream core-api unreachable',
        },
      });
    }
  }
}