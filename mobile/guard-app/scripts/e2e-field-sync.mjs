#!/usr/bin/env node
/**
 * Phase 12 field sync E2E (API-level, no Expo runtime).
 * Login as guard → resolve SITE-WAREHOUSE-A → CLOCK_IN via /field/sync → replay for DUPLICATE.
 *
 * Usage:
 *   node scripts/e2e-field-sync.mjs
 *   API_BASE=http://localhost:4001/api/v1 SITE_ID=<uuid> node scripts/e2e-field-sync.mjs
 */
import { randomUUID } from 'node:crypto';

const API_BASE = (
  process.env.API_BASE ||
  process.env.EXPO_PUBLIC_API_BASE ||
  'http://localhost:4001/api/v1'
).replace(/\/$/, '');

const EMAIL = process.env.GUARD_EMAIL || 'guard1@highlink.co.tz';
const PASSWORD = process.env.GUARD_PASSWORD || 'ChangeMe123!';
const SITE_CODE = process.env.SITE_CODE || 'SITE-WAREHOUSE-A';
const DEMO_GPS = { latitude: -6.7924, longitude: 39.2083 };

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → HTTP ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`,
    );
  }
  if (json && typeof json === 'object' && 'data' in json) return json.data;
  return json;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`==> API ${API_BASE}`);
  console.log(`==> Login ${EMAIL}`);
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = login.tokens?.accessToken;
  assert(token, 'missing accessToken');

  let siteId = process.env.SITE_ID || '';
  if (!siteId) {
    console.log(`==> Resolve site ${SITE_CODE}`);
    const sites = await request('/enterprise/sites', { token });
    const site = Array.isArray(sites)
      ? sites.find((s) => s.code === SITE_CODE)
      : null;
    assert(site?.id, `site ${SITE_CODE} not found — seed DB`);
    siteId = site.id;
  } else {
    console.log(`==> Using SITE_ID from env`);
  }
  console.log(`    siteId=${siteId}`);

  const clientEventId = randomUUID();
  const deviceTime = new Date().toISOString();
  const event = {
    type: 'CLOCK_IN',
    clientEventId,
    deviceTime,
    payload: {
      siteId,
      method: 'MOBILE_GPS',
      gps: DEMO_GPS,
    },
  };

  console.log('==> POST /field/sync CLOCK_IN (expect ACCEPTED)');
  const first = await request('/field/sync', {
    method: 'POST',
    token,
    body: { events: [event] },
  });
  assert(Array.isArray(first) && first.length === 1, 'expected 1 sync result');
  assert(
    first[0].status === 'ACCEPTED',
    `expected ACCEPTED, got ${first[0].status}: ${first[0].message || ''}`,
  );
  assert(first[0].serverId, 'expected serverId on ACCEPTED');
  console.log(`    ACCEPTED serverId=${first[0].serverId}`);

  console.log('==> Replay same clientEventId (expect DUPLICATE or ACCEPTED)');
  const second = await request('/field/sync', {
    method: 'POST',
    token,
    body: { events: [event] },
  });
  assert(Array.isArray(second) && second.length === 1, 'expected 1 replay result');
  const replayStatus = second[0].status;
  assert(
    replayStatus === 'DUPLICATE' || replayStatus === 'ACCEPTED',
    `expected DUPLICATE|ACCEPTED, got ${replayStatus}: ${second[0].message || ''}`,
  );
  console.log(`    replay status=${replayStatus}`);

  console.log('');
  console.log('Phase 12 field sync E2E OK');
  console.log(`  clientEventId=${clientEventId}`);
  console.log('  Note: deviceTime is audit metadata — payroll uses server-verified hours.');
}

main().catch((err) => {
  console.error('E2E FAILED:', err.message || err);
  process.exit(1);
});
