import { logger } from './logger.js';

/** Pull a human-readable message out of the various core-api error shapes. */
function extractError(json) {
  if (!json || typeof json !== 'object') return '';
  const candidates = [json.message, json.error?.message, json.error, json.detail];
  for (const c of candidates) {
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.join('; ');
  }
  return JSON.stringify(json);
}

/**
 * Thin transport to the cloud device-integration API (`/device-api/*`).
 *
 * Auth: an edge gateway forwarding multiple USB devices uses `X-Gateway-Key`;
 * a single self-pushing terminal uses `X-Device-Key`. When authenticated as a
 * gateway, every event MUST carry a `deviceCode` so the backend can resolve the
 * owning device (and enforce that it is bound to this gateway).
 *
 * Responses are unwrapped from the core-api `{ success, data, meta }` envelope.
 */
export class ApiClient {
  constructor({ apiUrl, gatewayKey, deviceKey, timeoutMs = 15000 }) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.gatewayKey = gatewayKey || '';
    this.deviceKey = deviceKey || '';
    this.timeoutMs = timeoutMs;
    this.isGateway = Boolean(gatewayKey);
  }

  #headers() {
    const headers = { 'content-type': 'application/json' };
    if (this.gatewayKey) headers['x-gateway-key'] = this.gatewayKey;
    else if (this.deviceKey) headers['x-device-key'] = this.deviceKey;
    return headers;
  }

  async #request(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.apiUrl}${path}`, {
        method,
        headers: this.#headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { raw: text };
      }
      if (!res.ok) {
        const msg = extractError(json) || `HTTP ${res.status}`;
        const err = new Error(`${method} ${path} failed: ${msg}`);
        err.status = res.status;
        err.body = json;
        throw err;
      }
      // Unwrap the standard response envelope when present.
      return json && typeof json === 'object' && 'data' in json ? json.data : json;
    } finally {
      clearTimeout(timer);
    }
  }

  heartbeat({ version, ipAddress } = {}) {
    return this.#request('POST', '/device-api/heartbeat', { version, ipAddress });
  }

  /**
   * Push a batch of normalized events. Each event:
   *   { type, capturedAt, dedupeKey?, deviceCode?, payload }
   * Returns { accepted, duplicates, routed }.
   */
  pushEvents(events) {
    if (!Array.isArray(events) || events.length === 0) {
      return Promise.resolve({ accepted: 0, duplicates: 0, routed: 0 });
    }
    return this.#request('POST', '/device-api/events', { events });
  }

  /** Poll pending commands (backend marks them DISPATCHED). Returns { commands: [...] }. */
  pollCommands() {
    return this.#request('GET', '/device-api/commands');
  }

  /** Acknowledge command execution result. status: 'ACKED' | 'FAILED'. */
  ackCommand(id, status, result) {
    return this.#request('POST', `/device-api/commands/${id}/ack`, { status, result });
  }

  async safeHeartbeat(meta) {
    try {
      return await this.heartbeat(meta);
    } catch (err) {
      logger.warn('heartbeat failed', { error: err.message });
      return null;
    }
  }
}
