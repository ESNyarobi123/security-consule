// Device-event domain-routing E2E (core-api :4001).
// Verifies that events ingested through the device pipeline are routed into
// their owning domains:
//   CARD_TAP         -> access-control  (customer employee entry)
//   ATTENDANCE_PUNCH -> attendance      (guard clock-in/out)
//   QR_SCAN          -> visitors        (gate verification)
// while unresolved refs stay store-only (routed=0) without failing ingest.

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
  return { status: res.status, data: json?.data ?? json };
}

const iso = (d) => new Date(d).toISOString();

async function pushEvent(gatewayKey, deviceCode, type, payload, suffix, tag) {
  return api('/device-api/events', {
    method: 'POST',
    gatewayKey,
    body: {
      events: [
        {
          type,
          capturedAt: new Date().toISOString(),
          dedupeKey: `route-${tag}-${suffix}`,
          deviceCode,
          payload,
        },
      ],
    },
  });
}

async function main() {
  console.log(`\nDevice routing E2E against ${BASE}\n`);
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
  const siteId = (sites.data ?? [])[0]?.id;
  const customers = await api('/customers', { token });
  const customerId = (customers.data ?? [])[0]?.id;
  check('has a site + customer to work with', !!siteId && !!customerId, `site=${siteId} cust=${customerId}`);
  if (!siteId || !customerId) return finish();

  const gw = await api('/devices/gateways', {
    method: 'POST',
    token,
    body: { code: `GW-RT-${suffix}`, name: 'Routing Test Gateway' },
  });
  const gatewayKey = gw.data?.apiKey;
  const gatewayId = gw.data?.id;
  check('register gateway', !!gatewayKey, `status=${gw.status}`);
  if (!gatewayKey) return finish();

  async function registerDevice(code, type, config) {
    const r = await api('/devices', {
      method: 'POST',
      token,
      body: { code, name: code, type, connection: 'USB', siteId, edgeGatewayId: gatewayId, config },
    });
    return r.data?.code;
  }

  // ───────────────────────── CARD_TAP -> access ─────────────────────────
  const cardRef = `CARD-${suffix}`;
  const emp = await api('/access/employees', {
    method: 'POST',
    token,
    body: { customerId, fullName: 'Routing Test Employee', accessCardRef: cardRef },
  });
  const employeeId = emp.data?.id;
  check('create customer employee w/ card ref', !!employeeId, `status=${emp.status}`);

  const rfidCode = await registerDevice(`RFID-${suffix}`, 'RFID_READER');
  const cardEv = await pushEvent(gatewayKey, rfidCode, 'CARD_TAP', { value: cardRef, direction: 'IN' }, suffix, 'card');
  check('CARD_TAP accepted', cardEv.data?.accepted === 1, JSON.stringify(cardEv.data));
  check('CARD_TAP routed to access (routed=1)', cardEv.data?.routed === 1, JSON.stringify(cardEv.data));

  const entries = await api(`/access/entries?customerId=${customerId}`, { token });
  const accessHit = (entries.data ?? []).find((e) => e.employeeId === employeeId && e.entryType === 'CHECK_IN');
  check('access entry recorded (CHECK_IN)', !!accessHit, `count=${(entries.data ?? []).length}`);

  // Unknown card ref -> store-only (routed=0), ingest still succeeds.
  const unknownCard = await pushEvent(gatewayKey, rfidCode, 'CARD_TAP', { value: `NOPE-${suffix}` }, suffix, 'card-unknown');
  check('unknown card accepted but routed=0', unknownCard.data?.accepted === 1 && unknownCard.data?.routed === 0, JSON.stringify(unknownCard.data));

  // ──────────────────── ATTENDANCE_PUNCH -> attendance ────────────────────
  const guards = await api('/guards', { token });
  const guard = (guards.data ?? []).find((g) => g.employeeNumber) ?? (guards.data ?? [])[0];
  check('has a guard to punch', !!guard?.employeeNumber, `count=${(guards.data ?? []).length}`);

  if (guard?.employeeNumber) {
    const fpCode = await registerDevice(`FP-${suffix}`, 'FINGERPRINT_SCANNER');
    const punchIn = await pushEvent(gatewayKey, fpCode, 'ATTENDANCE_PUNCH', { employeeNumber: guard.employeeNumber, direction: 'IN' }, suffix, 'punch-in');
    check('ATTENDANCE_PUNCH(IN) routed to attendance', punchIn.data?.routed === 1, JSON.stringify(punchIn.data));

    const attList = await api(`/attendance?siteId=${siteId}`, { token });
    const openRec = (attList.data ?? []).find((a) => a.guardId === guard.id && !a.clockOutAt);
    check('guard clock-in recorded (open)', !!openRec, `count=${(attList.data ?? []).length}`);

    const punchOut = await pushEvent(gatewayKey, fpCode, 'ATTENDANCE_PUNCH', { employeeNumber: guard.employeeNumber, direction: 'OUT' }, suffix, 'punch-out');
    check('ATTENDANCE_PUNCH(OUT) routed to attendance', punchOut.data?.routed === 1, JSON.stringify(punchOut.data));

    const attList2 = await api(`/attendance?siteId=${siteId}`, { token });
    const closedRec = (attList2.data ?? []).find((a) => a.guardId === guard.id && a.clockOutAt);
    check('guard clock-out recorded (closed)', !!closedRec, `count=${(attList2.data ?? []).length}`);
  }

  // ───────────────────────── QR_SCAN -> visitors ─────────────────────────
  // A QR gate scanner forwards the scanned code to visitors.gateVerify. We push
  // a code and assert the event routed into the visitors domain (a gate entry
  // is recorded). Issuing a real ALLOW code requires the public pre-registration
  // flow, which is exercised separately; here we prove the routing wiring.
  const entriesBefore = await api(`/visitors/entries?siteId=${siteId}`, { token });
  const beforeCount = (entriesBefore.data ?? []).length;

  const qrCode = await registerDevice(`QR-${suffix}`, 'QR_SCANNER', undefined);
  const qrEv = await pushEvent(gatewayKey, qrCode, 'QR_SCAN', { value: `GATE-${suffix}` }, suffix, 'qr');
  check('QR_SCAN accepted', qrEv.data?.accepted === 1, JSON.stringify(qrEv.data));
  check('QR_SCAN routed to visitors (routed=1)', qrEv.data?.routed === 1, JSON.stringify(qrEv.data));

  const entriesAfter = await api(`/visitors/entries?siteId=${siteId}`, { token });
  check('visitor gate entry recorded via device', (entriesAfter.data ?? []).length === beforeCount + 1, `before=${beforeCount} after=${(entriesAfter.data ?? []).length}`);

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
