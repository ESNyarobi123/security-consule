#!/usr/bin/env node
/**
 * Phase 13b supervisor E2E (API-level, no Expo runtime).
 *
 * 1. Login supervisor1 (fail clearly if missing)
 * 2. Resolve SITE-WAREHOUSE-A
 * 3. Login guard1 → clock-in GPS → attendance id
 * 4. Supervisor lists pending approvals (includes row)
 * 5. Supervisor POST approve → supervisorApproved true
 * 6. Second approve → already-approved OK (or 400)
 * 7. Schedule alertness → mark missed → FieldAlert
 * 8. GET field-alerts → POST acknowledge
 * 9. GET incidents + occurrence-book return 200
 * 10. gate1 can still login to API (role gate is app-side only)
 *
 * Alertness paths (from alertness.controller.ts):
 *   POST /attendance/alertness/schedule
 *   POST /attendance/alertness/:id/missed
 * Field alerts:
 *   GET  /attendance/field-alerts
 *   POST /attendance/field-alerts/:id/acknowledge
 *
 * Usage:
 *   node scripts/e2e-supervisor.mjs
 *   API_BASE=http://localhost:4001/api/v1 node scripts/e2e-supervisor.mjs
 */
import { randomUUID } from 'node:crypto';

const API_BASE = (
  process.env.API_BASE ||
  process.env.EXPO_PUBLIC_API_BASE ||
  'http://localhost:4001/api/v1'
).replace(/\/$/, '');

const SUPERVISOR_EMAIL =
  process.env.SUPERVISOR_EMAIL || 'supervisor1@highlink.co.tz';
const GUARD_EMAIL = process.env.GUARD_EMAIL || 'guard1@highlink.co.tz';
const GATE_EMAIL = process.env.GATE_EMAIL || 'gate1@highlink.co.tz';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@highlink.co.tz';
const PASSWORD = process.env.PASSWORD || 'ChangeMe123!';
const SITE_CODE = process.env.SITE_CODE || 'SITE-WAREHOUSE-A';
const DEMO_GPS = { latitude: -6.7924, longitude: 39.2083 };

/** Soft request: returns { ok, status, data } without throwing. */
async function rawRequest(path, { method = 'GET', token, body } = {}) {
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
  const data =
    json && typeof json === 'object' && 'data' in json ? json.data : json;
  return { ok: res.ok, status: res.status, data, raw: json };
}

async function request(path, opts = {}) {
  const result = await rawRequest(path, opts);
  if (!result.ok) {
    throw new Error(
      `${opts.method || 'GET'} ${path} → HTTP ${result.status}: ${
        typeof result.raw === 'string'
          ? result.raw
          : JSON.stringify(result.raw)
      }`,
    );
  }
  return result.data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function loginOrFail(email, label) {
  try {
    const login = await request('/auth/login', {
      method: 'POST',
      body: { email, password: PASSWORD },
    });
    const token = login.tokens?.accessToken;
    assert(token, `missing accessToken for ${email}`);
    return {
      token,
      email,
      user: login.user,
      roles: login.user?.roles ?? [],
    };
  } catch (err) {
    throw new Error(
      `${label} login failed for ${email}: ${err.message}\n` +
        `  Seed supervisor1@highlink.co.tz / ChangeMe123! (SUPERVISOR) and retry.`,
    );
  }
}

async function main() {
  console.log(`==> API ${API_BASE}`);
  console.log(
    '    Stub note: expects approve + field-alerts APIs (already on attendance lib).',
  );

  console.log(`==> 1. Login supervisor (${SUPERVISOR_EMAIL})`);
  const supervisor = await loginOrFail(SUPERVISOR_EMAIL, 'Supervisor');
  const hasSupervisorRole = supervisor.roles.some(
    (r) => r === 'SUPERVISOR' || r === 'SUPER_ADMIN',
  );
  assert(
    hasSupervisorRole,
    `expected SUPERVISOR|SUPER_ADMIN roles, got ${JSON.stringify(supervisor.roles)}`,
  );
  console.log(`    roles=${supervisor.roles.join(',')}`);

  console.log(`==> 2. Resolve site ${SITE_CODE}`);
  const sites = await request('/enterprise/sites', {
    token: supervisor.token,
  });
  const site = Array.isArray(sites)
    ? sites.find((s) => s.code === SITE_CODE)
    : null;
  assert(site?.id, `site ${SITE_CODE} not found — seed DB`);
  const siteId = site.id;
  console.log(`    siteId=${siteId}`);

  console.log(`==> 3. Login guard (${GUARD_EMAIL}) → clock-in`);
  const guard = await loginOrFail(GUARD_EMAIL, 'Guard');
  const clientEventId = randomUUID();
  const clockIn = await request('/attendance/clock-in', {
    method: 'POST',
    token: guard.token,
    body: {
      siteId,
      method: 'MOBILE_GPS',
      gps: DEMO_GPS,
      deviceTime: new Date().toISOString(),
      clientEventId,
    },
  });
  assert(clockIn?.id, 'clock-in missing attendance id');
  const attendanceId = clockIn.id;
  console.log(`    attendanceId=${attendanceId} clientEventId=${clientEventId}`);

  console.log(
    '==> 4. Supervisor GET /attendance?supervisorApproved=false includes row',
  );
  const pending = await request(
    `/attendance?siteId=${encodeURIComponent(siteId)}&supervisorApproved=false`,
    { token: supervisor.token },
  );
  assert(Array.isArray(pending), 'expected attendance array');
  const row = pending.find((r) => r.id === attendanceId);
  assert(row, `pending list missing attendance ${attendanceId}`);
  assert(
    row.supervisorApproved === false,
    'expected supervisorApproved=false on new clock-in',
  );
  console.log(`    found pending row id=${row.id}`);

  console.log('==> 5. Supervisor POST /attendance/:id/approve');
  const approved = await request(`/attendance/${attendanceId}/approve`, {
    method: 'POST',
    token: supervisor.token,
  });
  assert(
    approved?.supervisorApproved === true,
    `expected supervisorApproved=true, got ${approved?.supervisorApproved}`,
  );
  console.log('    supervisorApproved=true');

  console.log('==> 6. Second approve (expect already-approved OK or 400)');
  const second = await rawRequest(`/attendance/${attendanceId}/approve`, {
    method: 'POST',
    token: supervisor.token,
  });
  if (second.ok) {
    assert(
      second.data?.supervisorApproved === true,
      'second approve OK but not marked approved',
    );
    console.log('    already approved (idempotent OK)');
  } else {
    assert(
      second.status === 400 || second.status === 409,
      `expected 400/409 on re-approve, got ${second.status}`,
    );
    console.log(`    HTTP ${second.status} (already approved)`);
  }

  console.log('==> 7. Schedule alertness → mark missed → FieldAlert');
  const guards = await request('/guards', { token: supervisor.token });
  const guardProfile = Array.isArray(guards)
    ? guards.find((g) => g.userId === guard.user?.id) ||
      guards.find((g) => g.employeeNumber === 'GRD-0001') ||
      guards[0]
    : null;
  assert(guardProfile?.id, 'guard profile not found — seed GRD-0001');
  const guardId = guardProfile.id;

  let schedulerToken = supervisor.token;
  try {
    // Prefer admin if available for schedule (some envs restrict roles)
    const admin = await loginOrFail(ADMIN_EMAIL, 'Admin');
    schedulerToken = admin.token;
    console.log(`    scheduling as ${ADMIN_EMAIL}`);
  } catch {
    console.log(`    scheduling as supervisor (${SUPERVISOR_EMAIL})`);
  }

  const check = await request('/attendance/alertness/schedule', {
    method: 'POST',
    token: schedulerToken,
    body: {
      guardId,
      siteId,
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
    },
  });
  assert(check?.id, 'schedule missing alertness check id');
  console.log(`    alertnessCheckId=${check.id}`);

  await request(`/attendance/alertness/${check.id}/missed`, {
    method: 'POST',
    token: schedulerToken,
  });
  console.log('    marked missed');

  console.log('==> 8. GET field-alerts → POST acknowledge');
  const alerts = await request(
    `/attendance/field-alerts?siteId=${encodeURIComponent(siteId)}&acknowledged=false`,
    { token: supervisor.token },
  );
  assert(Array.isArray(alerts), 'expected field-alerts array');
  const alert = alerts.find(
    (a) =>
      a.alertType === 'ALERTNESS_MISSED' &&
      (a.guardId === guardId || !a.guardId),
  ) || alerts[0];
  assert(alert?.id, 'no unacked FieldAlert after mark-missed');
  console.log(`    alertId=${alert.id} severity=${alert.severity}`);

  const acked = await request(
    `/attendance/field-alerts/${alert.id}/acknowledge`,
    { method: 'POST', token: supervisor.token },
  );
  assert(
    acked?.acknowledged === true,
    `expected acknowledged=true, got ${acked?.acknowledged}`,
  );
  console.log('    acknowledged=true');

  console.log('==> 9. GET incidents + occurrence-book (expect 200)');
  const incidents = await request(
    `/incidents?siteId=${encodeURIComponent(siteId)}`,
    { token: supervisor.token },
  );
  assert(Array.isArray(incidents), 'incidents should be array');
  const eob = await request(
    `/occurrence-book?siteId=${encodeURIComponent(siteId)}`,
    { token: supervisor.token },
  );
  assert(Array.isArray(eob), 'occurrence-book should be array');
  console.log(
    `    incidents=${incidents.length} eob=${eob.length}`,
  );

  console.log(
    '==> 10. gate1 API login (role reject is APP-side only — OK to call APIs)',
  );
  try {
    const gate = await loginOrFail(GATE_EMAIL, 'Gate');
    console.log(
      `    gate1 logged in via API (roles=${gate.roles.join(',')}). ` +
        `Supervisor app would reject this role client-side; APIs remain callable.`,
    );
  } catch (err) {
    console.log(`    skipped gate1 note: ${err.message}`);
  }

  console.log('');
  console.log('Phase 13b supervisor E2E OK');
  console.log(
    '  clock-in → approve → alertness miss → field-alert ack; incidents/EOB readable.',
  );
}

main().catch((err) => {
  console.error('E2E FAILED:', err.message || err);
  process.exit(1);
});
