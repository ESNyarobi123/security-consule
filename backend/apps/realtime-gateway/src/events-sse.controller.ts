import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

interface RealtimeEvent {
  type: string;
  organizationId: string;
  payload: Record<string, unknown>;
  at: string;
}

const subscribers = new Map<string, Set<(event: RealtimeEvent) => void>>();

export function publishRealtimeEvent(event: RealtimeEvent) {
  const key = event.organizationId;
  const subs = subscribers.get(key);
  if (!subs) return;
  for (const fn of subs) fn(event);
}

@ApiTags('Realtime')
@Controller('events')
export class EventsSseController {
  private readonly logger = new Logger(EventsSseController.name);

  @Get('stream')
  @ApiOperation({ summary: 'SSE stream for org events (field alerts, ANPR)' })
  stream(
    @Query('organizationId') organizationId: string,
    @Res() reply: FastifyReply,
  ) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = (event: RealtimeEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    if (!organizationId) {
      reply.raw.write(`data: ${JSON.stringify({ error: 'organizationId required' })}\n\n`);
      return reply.raw.end();
    }

    let set = subscribers.get(organizationId);
    if (!set) {
      set = new Set();
      subscribers.set(organizationId, set);
    }
    set.add(send);
    this.logger.log(`SSE client connected org=${organizationId}`);

    reply.raw.write(
      `data: ${JSON.stringify({ type: 'connected', organizationId, at: new Date().toISOString() })}\n\n`,
    );

    reply.raw.on('close', () => {
      set?.delete(send);
      this.logger.log(`SSE client disconnected org=${organizationId}`);
    });
  }
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'realtime-gateway' };
  }
}

@ApiTags('Dev')
@Controller('dev')
export class DevPublishController {
  @Get('publish')
  publish(
    @Query('organizationId') organizationId: string,
    @Query('type') type: string,
  ) {
    const event: RealtimeEvent = {
      type: type ?? 'test.event',
      organizationId,
      payload: { demo: true },
      at: new Date().toISOString(),
    };
    publishRealtimeEvent(event);
    return { published: true };
  }
}
