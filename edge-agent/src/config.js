import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv() {
  const path = resolve(process.cwd(), process.env.EDGE_ENV_FILE || '.env');
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // No .env file — rely on process env only.
  }
}

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig() {
  loadDotEnv();

  const config = {
    apiUrl: (process.env.EDGE_API_URL || 'http://localhost:4001/api/v1').replace(/\/$/, ''),
    gatewayKey: process.env.EDGE_GATEWAY_KEY || '',
    deviceKey: process.env.EDGE_DEVICE_KEY || '',
    agentVersion: process.env.EDGE_AGENT_VERSION || '0.1.0',
    pollIntervalMs: int(process.env.EDGE_POLL_INTERVAL_MS, 5000),
    heartbeatIntervalMs: int(process.env.EDGE_HEARTBEAT_INTERVAL_MS, 30000),
    flushIntervalMs: int(process.env.EDGE_FLUSH_INTERVAL_MS, 3000),
    maxBatch: int(process.env.EDGE_MAX_BATCH, 50),
    queueFile: process.env.EDGE_QUEUE_FILE || './data/queue.jsonl',
    simulate: bool(process.env.EDGE_SIMULATE, false),

    hid: {
      enabled: bool(process.env.EDGE_HID_ENABLED, false),
      vendorId: int(process.env.EDGE_HID_VENDOR_ID, 0),
      productId: int(process.env.EDGE_HID_PRODUCT_ID, 0),
      path: process.env.EDGE_HID_PATH || '',
      deviceCode: process.env.EDGE_HID_DEVICE_CODE || 'HID-SCANNER-1',
      eventType: process.env.EDGE_HID_EVENT_TYPE || 'BARCODE_SCAN',
    },

    printer: {
      type: (process.env.EDGE_PRINTER_TYPE || 'noop').toLowerCase(),
      host: process.env.EDGE_PRINTER_HOST || '127.0.0.1',
      port: int(process.env.EDGE_PRINTER_PORT, 9100),
      ippUrl: process.env.EDGE_PRINTER_IPP_URL || '',
      deviceCode: process.env.EDGE_PRINTER_DEVICE_CODE || 'PRINTER-1',
    },
  };

  if (!config.gatewayKey && !config.deviceKey) {
    throw new Error(
      'Missing credentials: set EDGE_GATEWAY_KEY (recommended for multi-device hub) or EDGE_DEVICE_KEY.',
    );
  }

  return config;
}
