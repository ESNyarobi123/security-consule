#!/usr/bin/env node
/**
 * Phase 14 duty E2E (API-level, no Expo runtime).
 *
 * 1. Login guard1
 * 2. Resolve site + checkpoint CP-GATE-01
 * 3. GET pending alertness (schedule via admin if empty)
 * 4. POST /field/sync CLOCK_IN → ACCEPTED → attendanceId
 * 5. POST /field/sync ALERTNESS_CONFIRM → ACCEPTED; replay DUPLICATE|ACCEPTED
 * 6. POST /field/sync PATROL_SCAN CP-GATE-01 → ACCEPTED; bad code → REJECTED
 * 7. POST /field/sync CLOCK_OUT → ACCEPTED; replay DUPLICATE|ACCEPTED
 *
 * Usage:
 *   node scripts/e2e-duty.mjs
 *   API_BASE=http://localhost:4001/api/v1 node scripts/e2e-duty.mjs
 */
import { randomUUID } from 'node:crypto';

const API_BASE = (
  process.env.API_BASE ||
  process.env.EXPO_PUBLIC_API_BASE ||
  'http://localhost:4001/api/v1'
).replace(/\/$/, '');

const GUARD_EMAIL = process.env.GUARD_EMAIL || 'guard1@highlink.co.tz';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@highlink.co.tz';
const SUPERVISOR_EMAIL =
  process.env.SUPERVISOR_EMAIL || 'supervisor1@highlink.co.tz';
const PASSWORD = process.env.PASSWORD || 'ChangeMe123!';
const SITE_CODE = process.env.SITE_CODE || 'SITE-WAREHOUSE-A';
const CHECKPOINT_CODE = process.env.CHECKPOINT_CODE || 'CP-GATE-01';
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
      `${method} ${path} → HTTP ${res.status}: ${
        typeof json === 'string' ? json : JSON.stringify(json)
      }`,
    );
  }
  if (json && typeof json === 'object' && 'data' in json) return json.data;
  return json;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function login(email) {
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  const token = login.tokens?.accessToken;
  assert(token, `missing accessToken for ${email}`);
  return { token, user: login.user };
}

async function fieldSync(token, event) {
  const results = await request('/field/sync', {
    method: 'POST',
    token,
    body: { events: [event] },
  });
  assert(Array.isArray(results) && results.length === 1, 'expected 1 sync result');
  return results[0];
}

async function ensurePendingAlertness(guardToken, guardUser, siteId) {
  let pending = await request('/attendance/alertness/pending', {
    token: guardToken,
  });
  assert(Array.isArray(pending), 'pending alertness should be array');
  if (pending.length > 0) {
    console.log(`    pending=${pending.length} (using ${pending[0].id})`);
    return pending[0];
  }

  console.log('    pending empty — schedule via admin/supervisor');
  let schedulerToken;
  try {
    schedulerToken = (await login(ADMIN_EMAIL)).token;
    console.log(`    scheduling as ${ADMIN_EMAIL}`);
  } catch {
    schedulerToken = (await login(SUPERVISOR_EMAIL)).token;
    console.log(`    scheduling as ${SUPERVISOR_EMAIL}`);
  }

  const guards = await request('/guards', { token: schedulerToken });
  const guardProfile = Array.isArray(guards)
    ? guards.find((g) => g.userId === guardUser?.id) ||
      guards.find((g) => g.employeeNumber === 'GRD-0001') ||
      guards[0]
    : null;
  assert(guardProfile?.id, 'guard profile not found — seed GRD-0001');

  const check = await request('/attendance/alertness/schedule', {
    method: 'POST',
    token: schedulerToken,
    body: {
      guardId: guardProfile.id,
      siteId,
      scheduledAt: new Date().toISOString(),
    },
  });
  assert(check?.id, 'schedule missing alertness check id');
  console.log(`    scheduled alertnessCheckId=${check.id}`);

  pending = await request('/attendance/alertness/pending', {
    token: guardToken,
  });
  const row = Array.isArray(pending)
    ? pending.find((p) => p.id === check.id) || pending[0]
    : null;
  assert(row?.id, 'pending still empty after schedule');
  return row;
}

async function main() {
  console.log(`==> API ${API_BASE}`);
  console.log(`==> 1. Login ${GUARD_EMAIL}`);
  const guard = await login(GUARD_EMAIL);
  const token = guard.token;

  console.log(`==> 2. Resolve site ${SITE_CODE} + checkpoint ${CHECKPOINT_CODE}`);
  const sites = await request('/enterprise/sites', { token });
  const site = Array.isArray(sites)
    ? sites.find((s) => s.code === SITE_CODE)
    : null;
  assert(site?.id, `site ${SITE_CODE} not found — seed DB`);
  const siteId = site.id;

  const checkpoints = await request(
    `/operations/checkpoints?siteId=${encodeURIComponent(siteId)}`,
    { token },
  );
  assert(Array.isArray(checkpoints), 'checkpoints should be array');
  const checkpoint = checkpoints.find(
    (c) =>
      c.code === CHECKPOINT_CODE ||
      c.qrCode === CHECKPOINT_CODE ||
      c.nfcTagId === CHECKPOINT_CODE,
  );
  assert(checkpoint?.id, `checkpoint ${CHECKPOINT_CODE} not found — seed DB`);
  console.log(`    siteId=${siteId} checkpointId=${checkpoint.id}`);

  console.log('==> 3. GET pending alertness (schedule if empty)');
  const alertness = await ensurePendingAlertness(token, guard.user, siteId);

  console.log('==> 4. POST /field/sync CLOCK_IN (expect ACCEPTED)');
  const clockInEvent = {
    type: 'CLOCK_IN',
    clientEventId: randomUUID(),
    deviceTime: new Date().toISOString(),
    payload: {
      siteId,
      method: 'MOBILE_GPS',
      gps: DEMO_GPS,
    },
  };
  const clockIn = await fieldSync(token, clockInEvent);
  assert(
    clockIn.status === 'ACCEPTED',
    `CLOCK_IN expected ACCEPTED, got ${clockIn.status}: ${clockIn.message || ''}`,
  );
  assert(clockIn.serverId, 'CLOCK_IN missing serverId (attendanceId)');
  const attendanceId = clockIn.serverId;
  console.log(`    ACCEPTED attendanceId=${attendanceId}`);

  console.log('==> 5. POST /field/sync ALERTNESS_CONFIRM + replay');
  const confirmEvent = {
    type: 'ALERTNESS_CONFIRM',
    clientEventId: randomUUID(),
    deviceTime: new Date().toISOString(),
    payload: {
      alertnessCheckId: alertness.id,
      method: 'MOBILE_GPS',
      gps: DEMO_GPS,
    },
  };
  const confirm = await fieldSync(token, confirmEvent);
  assert(
    confirm.status === 'ACCEPTED',
    `ALERTNESS_CONFIRM expected ACCEPTED, got ${confirm.status}: ${confirm.message || ''}`,
  );
  console.log(`    ACCEPTED serverId=${confirm.serverId || alertness.id}`);

  const confirmReplay = await fieldSync(token, confirmEvent);
  assert(
    confirmReplay.status === 'DUPLICATE' || confirmReplay.status === 'ACCEPTED',
    `confirm replay expected DUPLICATE|ACCEPTED, got ${confirmReplay.status}: ${confirmReplay.message || ''}`,
  );
  console.log(`    replay status=${confirmReplay.status}`);

  console.log('==> 6. POST /field/sync PATROL_SCAN (good + bad code)');
  const patrolEvent = {
    type: 'PATROL_SCAN',
    clientEventId: randomUUID(),
    deviceTime: new Date().toISOString(),
    payload: {
      siteId,
      checkpointId: checkpoint.id,
      method: 'QR',
      qrOrNfcCode: CHECKPOINT_CODE,
      gps: DEMO_GPS,
    },
  };
  const patrol = await fieldSync(token, patrolEvent);
  assert(
    patrol.status === 'ACCEPTED',
    `PATROL_SCAN expected ACCEPTED, got ${patrol.status}: ${patrol.message || ''}`,
  );
  console.log(`    ACCEPTED serverId=${patrol.serverId}`);

  const badPatrol = await fieldSync(token, {
    type: 'PATROL_SCAN',
    clientEventId: randomUUID(),
    deviceTime: new Date().toISOString(),
    payload: {
      siteId,
      checkpointId: checkpoint.id,
      method: 'QR',
      qrOrNfcCode: 'BAD-CODE-XYZ',
      gps: DEMO_GPS,
    },
  });
  assert(
    badPatrol.status === 'REJECTED',
    `bad PATROL_SCAN expected REJECTED, got ${badPatrol.status}: ${badPatrol.message || ''}`,
  );
  console.log(`    bad code REJECTED (${badPatrol.message || 'ok'})`);

  console.log('==> 7. POST /field/sync CLOCK_OUT + replay');
  const clockOutEvent = {
    type: 'CLOCK_OUT',
    clientEventId: randomUUID(),
    deviceTime: new Date().toISOString(),
    payload: {
      attendanceId,
      method: 'MOBILE_GPS',
      gps: DEMO_GPS,
    },
  };
  const clockOut = await fieldSync(token, clockOutEvent);
  assert(
    clockOut.status === 'ACCEPTED',
    `CLOCK_OUT expected ACCEPTED, got ${clockOut.status}: ${clockOut.message || ''}`,
  );
  console.log(`    ACCEPTED serverId=${clockOut.serverId || attendanceId}`);

  const clockOutReplay = await fieldSync(token, clockOutEvent);
  assert(
    clockOutReplay.status === 'DUPLICATE' ||
      clockOutReplay.status === 'ACCEPTED',
    `CLOCK_OUT replay expected DUPLICATE|ACCEPTED, got ${clockOutReplay.status}: ${clockOutReplay.message || ''}`,
  );
  console.log(`    replay status=${clockOutReplay.status}`);

  console.log('');
  console.log('Phase 14 duty E2E OK');
  console.log(
    '  CLOCK_IN → ALERTNESS_CONFIRM → PATROL_SCAN → CLOCK_OUT (idempotent replays).',
  );
  console.log('  Note: deviceTime is audit metadata — payroll uses server-verified hours.');
}

main().catch((err) => {
  console.error('E2E FAILED:', err.message || err);
  process.exit(1);
});
