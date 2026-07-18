import { randomUUID } from 'node:crypto';
import { logger } from './logger.js';

/**
 * Orchestrates the site edge loop:
 *   1. captured device events → durable queue → flushed to /device-api/events
 *   2. /device-api/commands polled → executed locally → acked
 *   3. periodic heartbeat keeps the gateway/device ONLINE in the console
 *
 * All network work is best-effort: failures are logged and retried on the next
 * tick, and unflushed events stay on disk (at-least-once; backend dedupes).
 */
export class EdgeAgent {
  constructor({ config, api, queue, executor }) {
    this.config = config;
    this.api = api;
    this.queue = queue;
    this.executor = executor;
    this.timers = [];
    this.flushing = false;
    this.polling = false;
    this.stopped = false;
  }

  /** Capture a device reading and durably enqueue it for delivery. */
  capture({ type, deviceCode, payload }) {
    const event = {
      type,
      capturedAt: new Date().toISOString(),
      dedupeKey: randomUUID(),
      ...(this.api.isGateway ? { deviceCode: deviceCode || this.config.hid.deviceCode } : {}),
      payload: payload || {},
    };
    this.queue.enqueue(event);
    logger.info('event captured', { type, deviceCode: event.deviceCode, pending: this.queue.size });
    return event;
  }

  async flush() {
    if (this.flushing || this.queue.size === 0) return;
    this.flushing = true;
    try {
      const batch = this.queue.peekBatch(this.config.maxBatch);
      const res = await this.api.pushEvents(batch);
      this.queue.ackBatch(batch.length);
      logger.info('events flushed', {
        sent: batch.length,
        accepted: res?.accepted,
        duplicates: res?.duplicates,
        routed: res?.routed,
        remaining: this.queue.size,
      });
    } catch (err) {
      logger.warn('flush failed; will retry', { error: err.message, pending: this.queue.size });
    } finally {
      this.flushing = false;
    }
  }

  async pollAndExecute() {
    if (this.polling) return;
    this.polling = true;
    try {
      const res = await this.api.pollCommands();
      const commands = res?.commands || [];
      if (commands.length === 0) return;
      logger.info('commands received', { count: commands.length });
      for (const command of commands) {
        const { status, result } = await this.executor.execute(command);
        try {
          await this.api.ackCommand(command.id, status, result);
          logger.info('command acked', { id: command.id, status });
        } catch (err) {
          logger.warn('ack failed', { id: command.id, error: err.message });
        }
      }
    } catch (err) {
      logger.warn('poll failed', { error: err.message });
    } finally {
      this.polling = false;
    }
  }

  async #heartbeat() {
    const res = await this.api.safeHeartbeat({ version: this.config.agentVersion });
    if (res) logger.debug('heartbeat ok', { pendingCommands: res.pendingCommands });
  }

  #every(ms, fn) {
    const t = setInterval(() => {
      if (this.stopped) return;
      Promise.resolve(fn()).catch((err) => logger.error('loop error', { error: err.message }));
    }, ms);
    this.timers.push(t);
  }

  async start() {
    logger.info('edge agent starting', {
      apiUrl: this.config.apiUrl,
      mode: this.api.isGateway ? 'gateway' : 'device',
      simulate: this.config.simulate,
    });
    await this.#heartbeat();
    this.#every(this.config.heartbeatIntervalMs, () => this.#heartbeat());
    this.#every(this.config.flushIntervalMs, () => this.flush());
    this.#every(this.config.pollIntervalMs, () => this.pollAndExecute());
  }

  stop() {
    this.stopped = true;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    logger.info('edge agent stopped');
  }
}
