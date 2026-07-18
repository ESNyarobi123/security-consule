#!/usr/bin/env node
/**
 * Phase 13 gate verify E2E (API-level, no Expo runtime).
 * Public pre-register (no auth) → admin approves (SoD) → capture code once →
 * gate officer verifies ALLOWED → replay same clientEventId (idempotent) →
 * new clientEventId on used code → DENIED_*.
 *
 * Usage:
 *   node scripts/e2e-gate-verify.mjs
 *   API_BASE=http://localhost:4001/api/v1 node scripts/e2e-gate-verify.mjs
 */
import { randomUUID } from 'node:crypto';

const API_BASE = (
  process.env.API_BASE ||
  process.env.EXPO_PUBLIC_API_BASE ||
  'http://localhost:4001/api/v1'
).replace(/\/$/, '');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@highlink.co.tz';
const GATE_EMAIL = process.env.GATE_EMAIL || 'gate1@highlink.co.tz';
const PASSWORD = process.env.PASSWORD || 'ChangeMe123!';
const SITE_CODE = process.env.SITE_CODE || 'SITE-WAREHOUSE-A';
const GATE_CODE = process.env.GATE_CODE || 'GATE-MAIN';

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

/** Login preferring preferredEmail; fall back to alternateEmail. */
async function loginPrefer(preferredEmail, alternateEmail) {
  try {
    const login = await request('/auth/login', {
      method: 'POST',
      body: { email: preferredEmail, password: PASSWORD },
    });
    const token = login.tokens?.accessToken;
    assert(token, `missing accessToken for ${preferredEmail}`);
    return { token, email: preferredEmail };
  } catch (err) {
    if (!alternateEmail || alternateEmail === preferredEmail) throw err;
    console.log(
      `    ${preferredEmail} unavailable (${err.message}); trying ${alternateEmail}`,
    );
    const login = await request('/auth/login', {
      method: 'POST',
      body: { email: alternateEmail, password: PASSWORD },
    });
    const token = login.tokens?.accessToken;
    assert(token, `missing accessToken for ${alternateEmail}`);
    return { token, email: alternateEmail };
  }
}

/** Strip known one-time secret fields from objects used after the approve capture. */
function assertNoLeftoverSecrets(obj, label) {
  const json = JSON.stringify(obj);
  assert(
    !/"verificationCode"\s*:/.test(json),
    `${label} must not contain verificationCode after one-time approve capture`,
  );
  assert(
    !/"codeHash"\s*:/.test(json),
    `${label} must not contain codeHash`,
  );
  assert(
    !/"passwordHash"\s*:/.test(json),
    `${label} must not contain passwordHash`,
  );
}

async function main() {
  console.log(`==> API ${API_BASE}`);

  console.log(`==> Login admin (${ADMIN_EMAIL}) for approve + site resolve`);
  const admin = await loginPrefer(ADMIN_EMAIL, null);
  console.log(`    admin=${admin.email}`);

  console.log('==> Resolve public-config (fallback: enterprise/sites)');
  let organizationId;
  let customerId;
  let siteId;
  try {
    const cfg = await request('/visitors/public-config');
    organizationId = cfg.organizationId;
    customerId = cfg.customerId;
    siteId = cfg.siteId;
    console.log(
      `    public-config site=${cfg.siteCode} customer=${cfg.customerCode}`,
    );
  } catch {
    const sites = await request('/enterprise/sites', { token: admin.token });
    const site = Array.isArray(sites)
      ? sites.find((s) => s.code === SITE_CODE)
      : null;
    assert(site?.id, `site ${SITE_CODE} not found — seed DB`);
    siteId = site.id;
    organizationId = site.organizationId;
    const customers = await request('/customers', { token: admin.token });
    const customer = Array.isArray(customers)
      ? customers.find((c) => c.code === 'CUST-DEMO') || customers[0]
      : null;
    assert(customer?.id, 'customer not found — seed DB');
    customerId = customer.id;
    console.log(`    fallback siteId=${siteId} customerId=${customerId}`);
  }
  assert(organizationId && customerId && siteId, 'missing demo ids');

  console.log(`==> Resolve gate ${GATE_CODE}`);
  const gates = await request(
    `/enterprise/gates?siteId=${encodeURIComponent(siteId)}`,
    { token: admin.token },
  );
  const gate = Array.isArray(gates)
    ? gates.find((g) => g.code === GATE_CODE)
    : null;
  assert(gate?.id, `gate ${GATE_CODE} not found — seed DB`);
  console.log(`    gateId=${gate.id}`);

  const now = Date.now();
  const validFrom = new Date(now - 60_000).toISOString();
  const validUntil = new Date(now + 4 * 60 * 60_000).toISOString();
  const visitorName = `E2E Gate Visitor ${now}`;

  console.log(
    '==> Create PENDING appointment (public pre-register, no auth — SoD)',
  );
  const appointment = await request('/visitors/appointments', {
    method: 'POST',
    body: {
      organizationId,
      customerId,
      siteId,
      gateId: gate.id,
      visitorName,
      visitorPhone: '+255755999001',
      purpose: 'Phase 13 gate E2E',
      validFrom,
      validUntil,
    },
  });
  assert(appointment?.id, 'missing appointment id');
  assertNoLeftoverSecrets(appointment, 'create appointment response');
  console.log(`    appointmentId=${appointment.id}`);

  console.log('==> Admin approves → capture verificationCode (once)');
  const issued = await request(
    `/visitors/appointments/${appointment.id}/approve`,
    { method: 'POST', token: admin.token },
  );
  const verificationCode = issued?.verificationCode;
  assert(
    typeof verificationCode === 'string' && verificationCode.length >= 4,
    'approve must return verificationCode once',
  );
  assert(issued?.appointment?.status === 'APPROVED', 'expected APPROVED');
  // Keep code only in local binding for the verify steps below.
  const { verificationCode: _once, ...issuedPublic } = issued;
  assertNoLeftoverSecrets(issuedPublic, 'approve response without code');
  console.log(`    code captured (length=${verificationCode.length})`);

  console.log(
    `==> Login gate officer (prefer ${GATE_EMAIL}, else ${ADMIN_EMAIL})`,
  );
  const officer = await loginPrefer(GATE_EMAIL, ADMIN_EMAIL);
  console.log(`    officer=${officer.email}`);

  const clientEventId = randomUUID();
  console.log('==> POST /visitors/gate/verify (expect ALLOWED)');
  const first = await request('/visitors/gate/verify', {
    method: 'POST',
    token: officer.token,
    body: {
      code: verificationCode,
      siteId,
      gateId: gate.id,
      clientEventId,
      visitorPhone: '+255755999001',
    },
  });
  assert(first?.allowed === true, `expected allowed=true, got ${first?.allowed}`);
  assert(first?.result === 'ALLOWED', `expected ALLOWED, got ${first?.result}`);
  assert(
    first?.entry?.visitorName === visitorName,
    `visitor name mismatch: ${first?.entry?.visitorName}`,
  );
  assertNoLeftoverSecrets(first, 'first verify response');
  console.log(`    ALLOWED entryId=${first.entry?.id}`);

  console.log(
    '==> Replay same clientEventId (expect idempotent ALLOWED)',
  );
  const replay = await request('/visitors/gate/verify', {
    method: 'POST',
    token: officer.token,
    body: {
      code: verificationCode,
      siteId,
      gateId: gate.id,
      clientEventId,
      visitorPhone: '+255755999001',
    },
  });
  assert(
    replay?.allowed === true,
    `expected allowed=true on idempotent replay, got ${replay?.allowed}`,
  );
  assert(
    replay?.result === 'ALLOWED',
    `expected ALLOWED on idempotent replay, got ${replay?.result}`,
  );
  assertNoLeftoverSecrets(replay, 'idempotent replay verify response');
  console.log(`    ALLOWED (idempotent) entryId=${replay.entry?.id}`);

  console.log('==> Verify same code with new clientEventId (expect DENIED_*)');
  const second = await request('/visitors/gate/verify', {
    method: 'POST',
    token: officer.token,
    body: {
      code: verificationCode,
      siteId,
      gateId: gate.id,
      clientEventId: randomUUID(),
      visitorPhone: '+255755999001',
    },
  });
  assert(second?.allowed === false, 'expected allowed=false on used-code replay');
  assert(
    typeof second?.result === 'string' && second.result.startsWith('DENIED_'),
    `expected DENIED_*, got ${second?.result}`,
  );
  assertNoLeftoverSecrets(second, 'second verify response');
  console.log(`    ${second.result}`);

  console.log('');
  console.log('Phase 13 gate verify E2E OK');
  console.log(
    '  Public create + admin approve (SoD); idempotent clientEventId; verify has no leftover secrets.',
  );
}

main().catch((err) => {
  console.error('E2E FAILED:', err.message || err);
  process.exit(1);
});
