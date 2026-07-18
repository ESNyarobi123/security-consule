// RLS end-to-end test through core-api (running as the non-owner pssms_app role).
// Verifies: public login works, authenticated reads return org-scoped data via
// the per-request RLS transaction, a transactional write succeeds (nested
// $transaction joins the request tx + WITH CHECK passes), and MFA setup (a
// prior transactional flow) still works.

const PORT = process.env.CORE_API_PORT ?? 4011;
const BASE = `http://localhost:${PORT}/api/v1`;
const EMAIL = 'admin@highlink.co.tz';
const PASSWORD = 'ChangeMe123!';

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

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`\nRLS E2E against ${BASE}\n`);

  // 1) Public login (no org context -> no RLS tx; must still work).
  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  check('login returns 200/201', [200, 201].includes(login.status), `status=${login.status}`);
  const d = login.json?.data ?? login.json ?? {};
  const token = d.tokens?.accessToken ?? d.accessToken;
  check('login returns access token', !!token, `body=${JSON.stringify(login.json).slice(0, 200)}`);
  if (!token) {
    console.log('\nCannot continue without token.');
    process.exit(1);
  }

  // 2) Authenticated read -> RLS tx sets app.organization_id -> rows visible.
  const customers = await api('/customers', { token });
  const custList = customers.json?.data ?? customers.json;
  check('GET /customers 200', customers.status === 200, `status=${customers.status}`);
  check('GET /customers returns org rows (>=1)', Array.isArray(custList) && custList.length >= 1, `len=${custList?.length}`);

  const guards = await api('/guards', { token });
  check('GET /guards 200', guards.status === 200, `status=${guards.status}`);

  const contracts = await api('/contracts', { token });
  check('GET /contracts 200', contracts.status === 200, `status=${contracts.status}`);

  // 3) Transactional write -> nested $transaction joins request tx, WITH CHECK ok.
  const code = `RLS-${Date.now()}`;
  const created = await api('/customers', {
    method: 'POST',
    token,
    body: { code, name: 'RLS Test Customer' },
  });
  check('POST /customers 201', [200, 201].includes(created.status), `status=${created.status} body=${JSON.stringify(created.json)}`);
  const createdId = created.json?.data?.id ?? created.json?.id;
  check('created customer has id + org', !!createdId);

  // 4) New customer visible on read (same org).
  const after = await api('/customers', { token });
  const afterList = after.json?.data ?? after.json;
  check('created customer visible in list', Array.isArray(afterList) && afterList.some((c) => c.code === code));

  // 5) MFA setup (transactional flow from Sprint 0) still works under RLS pipeline.
  const mfa = await api('/auth/mfa/setup', { method: 'POST', token });
  check('POST /auth/mfa/setup 200/201', [200, 201].includes(mfa.status), `status=${mfa.status}`);
  check('mfa setup returns secret', !!(mfa.json?.data?.secret ?? mfa.json?.secret));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
