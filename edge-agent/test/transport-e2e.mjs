// Edge-agent transport E2E against a LIVE core-api.
//
// Validates the agent's real code paths (ApiClient, EventQueue, CommandExecutor,
// EdgeAgent) end-to-end: register gateway + USB device, heartbeat, capture →
// durable queue → flush, dedupe, and the command loop (issue → poll → execute
// with a noop printer → ack). No physical hardware required.

import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiClient } from '../src/api-client.js';
import { EventQueue } from '../src/queue.js';
import { createPrinter } from '../src/printers/index.js';
import { CommandExecutor } from '../src/command-executor.js';
import { EdgeAgent } from '../src/agent.js';

const API_URL = (process.env.E2E_API_URL || 'http://localhost:4001/api/v1').replace(/\/$/, '');
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@highlink.co.tz';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!';

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

async function admin(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data: json?.data ?? json };
}

async function main() {
  console.log(`\nEdge-agent transport E2E against ${API_URL}\n`);
  const suffix = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), 'edge-agent-'));
  const queueFile = join(tmp, 'queue.jsonl');

  // ── Arrange: admin registers a gateway + a USB QR scanner behind it ──
  const login = await admin('/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = login.data?.tokens?.accessToken ?? login.data?.accessToken;
  check('admin login', !!token, `status=${login.status}`);
  if (!token) return finish();

  const gw = await admin('/devices/gateways', {
    method: 'POST',
    token,
    body: { code: `GW-EA-${suffix}`, name: 'Edge Agent Test Gateway' },
  });
  const gatewayKey = gw.data?.apiKey;
  const gatewayId = gw.data?.id;
  check('register gateway (apiKey issued)', !!gatewayKey, `status=${gw.status}`);

  const deviceCode = `QR-EA-${suffix}`;
  const dev = await admin('/devices', {
    method: 'POST',
    token,
    body: {
      code: deviceCode,
      name: 'USB QR Scanner',
      type: 'QR_SCANNER',
      connection: 'USB',
      edgeGatewayId: gatewayId,
    },
  });
  const deviceId = dev.data?.id;
  check('register USB device behind gateway', !!deviceId, `status=${dev.status}`);
  if (!gatewayKey || !deviceId) return finish(tmp);

  // ── Build the agent exactly as production would (gateway auth) ──
  const api = new ApiClient({ apiUrl: API_URL, gatewayKey });
  const queue = new EventQueue(queueFile);
  const printer = createPrinter({ type: 'noop' }, { forceNoop: true });
  const executor = new CommandExecutor({ printer });
  const agent = new EdgeAgent({
    config: {
      apiUrl: API_URL,
      maxBatch: 50,
      agentVersion: 'test',
      hid: { deviceCode },
    },
    api,
    queue,
    executor,
  });

  // ── Heartbeat ──
  const hb = await api.heartbeat({ version: 'test' });
  check('gateway heartbeat ok', hb?.ok === true && hb?.kind === 'gateway', JSON.stringify(hb));

  // ── Capture → durable queue → flush ──
  agent.capture({ type: 'QR_SCAN', deviceCode, payload: { value: 'PASS-123', source: 'test' } });
  check('event enqueued (durable)', queue.size === 1 && existsSync(queueFile));
  await agent.flush();
  check('event flushed, queue drained', queue.size === 0);

  // ── Durable-queue persistence: reload from disk ──
  agent.capture({ type: 'QR_SCAN', deviceCode, payload: { value: 'PERSIST-1' } });
  const reloaded = new EventQueue(queueFile);
  check('queue restored from disk after restart', reloaded.size === 1);
  await agent.flush();
  check('restored event flushed', queue.size === 0);

  // ── Idempotency: same dedupeKey pushed twice ──
  const dedupeKey = `ea-dupe-${suffix}`;
  const ev = {
    type: 'QR_SCAN',
    capturedAt: new Date().toISOString(),
    dedupeKey,
    deviceCode,
    payload: { value: 'DUPE' },
  };
  const first = await api.pushEvents([ev]);
  const second = await api.pushEvents([ev]);
  check('first push accepted=1', first?.accepted === 1, JSON.stringify(first));
  check('duplicate ignored (duplicates=1)', second?.duplicates === 1 && second?.accepted === 0, JSON.stringify(second));

  // ── Command loop: admin issues PRINT → agent polls → executes → acks ──
  const cmd = await admin(`/devices/${deviceId}/commands`, {
    method: 'POST',
    token,
    body: {
      type: 'PRINT',
      payload: { title: 'GATE PASS', lines: ['Visitor: Jane Doe', 'Valid: today'], qr: 'PASS-123' },
    },
  });
  const cmdId = cmd.data?.id;
  check('admin issues PRINT command', !!cmdId, `status=${cmd.status}`);

  await agent.pollAndExecute();
  const list = await admin(`/devices/${deviceId}/commands`, { token });
  const acked = (list.data ?? []).find((c) => c.id === cmdId);
  check('command executed + ACKED via agent', acked?.status === 'ACKED', `status=${acked?.status}`);
  check('ack carries printer result', acked?.result?.printed === true, JSON.stringify(acked?.result));

  // ── Device reflects activity ──
  const detail = await admin(`/devices/${deviceId}`, { token });
  check('device pendingCommands=0', detail.data?.pendingCommands === 0);
  check('device eventCount>=3', (detail.data?.eventCount ?? 0) >= 3, `count=${detail.data?.eventCount}`);

  // ── Auth negative: bad gateway key rejected ──
  const badApi = new ApiClient({ apiUrl: API_URL, gatewayKey: 'gw_invalid_key' });
  let rejected = false;
  try {
    await badApi.heartbeat();
  } catch (err) {
    rejected = err.status === 401;
  }
  check('invalid gateway key -> 401', rejected);

  // ── Cleanup: disable the test device ──
  await admin(`/devices/${deviceId}`, { method: 'PATCH', token, body: { status: 'DISABLED' } });

  finish(tmp);
}

function finish(tmp) {
  if (tmp) {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
