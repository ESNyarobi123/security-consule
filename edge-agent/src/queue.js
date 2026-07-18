import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from './logger.js';

/**
 * Durable, file-backed FIFO queue for device events.
 *
 * Site connectivity is unreliable, so events are persisted to a JSONL file the
 * moment they are captured. They survive process restarts and are only removed
 * after the backend confirms ingestion — guaranteeing at-least-once delivery
 * (the backend deduplicates via `dedupeKey`).
 */
export class EventQueue {
  constructor(filePath) {
    this.filePath = filePath;
    this.items = [];
    this.#ensureDir();
    this.#load();
  }

  #ensureDir() {
    const dir = dirname(this.filePath);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  #load() {
    if (!existsSync(this.filePath)) return;
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      this.items = raw
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => JSON.parse(l));
      logger.info('event queue restored', { pending: this.items.length });
    } catch (err) {
      logger.warn('failed to restore queue; starting empty', { error: err.message });
      this.items = [];
    }
  }

  #persist() {
    const body = this.items.map((i) => JSON.stringify(i)).join('\n');
    writeFileSync(this.filePath, body ? `${body}\n` : '');
  }

  get size() {
    return this.items.length;
  }

  enqueue(event) {
    this.items.push(event);
    try {
      appendFileSync(this.filePath, `${JSON.stringify(event)}\n`);
    } catch (err) {
      logger.warn('failed to append event to disk', { error: err.message });
    }
  }

  peekBatch(max) {
    return this.items.slice(0, max);
  }

  /** Remove the first `count` items after successful delivery. */
  ackBatch(count) {
    this.items.splice(0, count);
    this.#persist();
  }
}
