// Public visitor pre-registration + gate-verification E2E (core-api :4001).
// Proves the RLS-safe public flow end-to-end:
//   public POST /visitors/appointments (NO auth) -> admin approve (issues code)
//   -> QR device forwards code -> gateVerify ALLOWED (routed to visitors).

const PORT = process.env.CORE_API_PORT ?? 4001;
const BASE = `http://localhost:${PORT}/api/v1`;
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

async function api(path, { method = 'GET', token, gatewayKey, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (gatewayKey) headers['x-gateway-key'] = gatewayKey;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
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
  return { status: res.status, data: json?.data ?? json, raw: json };
}

const iso = (d) => new Date(d).toISOString();

async function main() {
  console.log(`\nPublic visitor flow E2E against ${BASE}\n`);
  const suffix = Date.now();

  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = login.data?.tokens?.accessToken ?? login.data?.accessToken;
  const orgId = login.data?.user?.organizationId;
  check('admin login', !!token, `status=${login.status}`);
  if (!token) return finish();

  const sites = await api('/enterprise/sites', { token });
  const site = (sites.data ?? [])[0];
  const siteId = site?.id;
  const customerId = site?.customerId ?? (await api('/customers', { token })).data?.[0]?.id;
  check('has site + customer', !!siteId && !!customerId, `site=${siteId} cust=${customerId}`);
  if (!siteId || !customerId) return finish();

  // 1) PUBLIC pre-registration — NO auth header. Previously failed with
  //    "Customer not found in your organization" (RLS fail-closed).
  const appt = await api('/visitors/appointments', {
    method: 'POST',
    body: {
      organizationId: orgId,
      customerId,
      siteId,
      visitorName: 'Public Visitor',
      visitorPhone: `+25570${suffix % 10000000}`,
      purpose: 'Public pre-registration E2E',
      validFrom: iso(Date.now() - 3600_000),
      validUntil: iso(Date.now() + 86_400_000),
    },
  });
  const apptId = appt.data?.id;
  check('public appointment created (RLS-safe, no auth)', !!apptId, `status=${appt.status} body=${JSON.stringify(appt.raw).slice(0, 160)}`);
  if (!apptId) return finish();

  // 2) Admin approves -> verification code issued.
  const approved = await api(`/visitors/appointments/${apptId}/approve`, { method: 'POST', token });
  const code = approved.data?.verificationCode;
  const gateSite = approved.data?.siteId ?? siteId;
  check('admin approve issues verification code', !!code, `status=${approved.status}`);
  if (!code) return finish();

  // 3) Register a gateway + QR scanner at the gate site.
  const gw = await api('/devices/gateways', {
    method: 'POST',
    token,
    body: { code: `GW-VIS-${suffix}`, name: 'Visitor Gate Gateway' },
  });
  const gatewayKey = gw.data?.apiKey;
  const gatewayId = gw.data?.id;
  const qr = await api('/devices', {
    method: 'POST',
    token,
    body: { code: `QR-VIS-${suffix}`, name: 'Gate QR Scanner', type: 'QR_SCANNER', connection: 'USB', siteId: gateSite, edgeGatewayId: gatewayId },
  });
  check('register gateway + QR device', !!gatewayKey && !!qr.data?.code, `gw=${gw.status} qr=${qr.status}`);

  // 4) Device forwards the scanned code -> routed to visitors -> ALLOWED.
  const ev = await api('/device-api/events', {
    method: 'POST',
    gatewayKey,
    body: {
      events: [
        {
          type: 'QR_SCAN',
          capturedAt: new Date().toISOString(),
          dedupeKey: `vis-${suffix}`,
          deviceCode: qr.data.code,
          payload: { value: code },
        },
      ],
    },
  });
  check('QR_SCAN routed to visitors (routed=1)', ev.data?.routed === 1, JSON.stringify(ev.data));

  const entries = await api(`/visitors/entries?siteId=${gateSite}`, { token });
  const hit = (entries.data ?? []).find((e) => e.visitorName === 'Public Visitor');
  check('gate entry recorded ALLOWED for the visitor', hit?.result === 'ALLOWED', `result=${hit?.result} count=${(entries.data ?? []).length}`);

  finish();
}

function finish() {
  console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
