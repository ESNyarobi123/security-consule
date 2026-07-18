// Device-integration E2E through core-api (running as pssms_app under RLS).
// Exercises: gateway/device registration, device + gateway auth, heartbeat,
// event ingestion + idempotency, ANPR routing into parking, and the full
// command lifecycle (issue -> poll -> ack).

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

async function api(path, { method = 'GET', token, key, gatewayKey, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (key) headers['x-device-key'] = key;
  if (gatewayKey) headers['x-gateway-key'] = gatewayKey;
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
const data = (r) => r.json?.data ?? r.json;

async function main() {
  console.log(`\nDevices E2E against ${BASE}\n`);
  const suffix = Date.now();

  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = data(login)?.tokens?.accessToken ?? data(login)?.accessToken;
  check('login', !!token, `status=${login.status}`);
  if (!token) process.exit(1);

  // 1) Register an edge gateway (USB devices forward through it).
  const gw = await api('/devices/gateways', {
    method: 'POST',
    token,
    body: { code: `GW-${suffix}`, name: 'Test Edge Gateway' },
  });
  const gatewayKey = data(gw)?.apiKey;
  check('register gateway returns apiKey once', !!gatewayKey, `status=${gw.status} body=${JSON.stringify(gw.json).slice(0,160)}`);

  // 2) Register a direct-push network terminal (biometric).
  const term = await api('/devices', {
    method: 'POST',
    token,
    body: {
      code: `BIO-${suffix}`,
      name: 'Biometric Terminal',
      type: 'BIOMETRIC_TERMINAL',
      connection: 'NETWORK',
      directPush: true,
      siteId: 'site-hq',
    },
  });
  const deviceKey = data(term)?.apiKey;
  check('register direct-push device returns apiKey', !!deviceKey, `status=${term.status}`);

  // 3) Register a USB fingerprint scanner behind the gateway.
  const gwId = data(gw)?.id;
  const fp = await api('/devices', {
    method: 'POST',
    token,
    body: {
      code: `FP-${suffix}`,
      name: 'USB Fingerprint Scanner',
      type: 'FINGERPRINT_SCANNER',
      connection: 'USB',
      edgeGatewayId: gwId,
    },
  });
  const fpId = data(fp)?.id;
  check('register USB device behind gateway', !!fpId, `status=${fp.status}`);

  // 4) Device heartbeat via device key.
  const hb = await api('/device-api/heartbeat', {
    method: 'POST',
    key: deviceKey,
    body: { version: '1.0.0' },
  });
  check('device heartbeat ok', data(hb)?.ok === true, `status=${hb.status} body=${JSON.stringify(hb.json)}`);

  // 5) Ingest an attendance punch (stored, append-only) with idempotency key.
  const dedupe = `punch-${suffix}`;
  const ing1 = await api('/device-api/events', {
    method: 'POST',
    key: deviceKey,
    body: {
      events: [
        {
          type: 'ATTENDANCE_PUNCH',
          capturedAt: new Date().toISOString(),
          dedupeKey: dedupe,
          payload: { userId: '1001', direction: 'IN' },
        },
      ],
    },
  });
  check('ingest punch accepted=1', data(ing1)?.accepted === 1, `body=${JSON.stringify(ing1.json)}`);

  // 6) Re-ingest same dedupeKey -> duplicate ignored.
  const ing2 = await api('/device-api/events', {
    method: 'POST',
    key: deviceKey,
    body: {
      events: [
        {
          type: 'ATTENDANCE_PUNCH',
          capturedAt: new Date().toISOString(),
          dedupeKey: dedupe,
          payload: { userId: '1001', direction: 'IN' },
        },
      ],
    },
  });
  check('duplicate punch ignored', data(ing2)?.duplicates === 1 && data(ing2)?.accepted === 0, `body=${JSON.stringify(ing2.json)}`);

  // 7) Ingest an ANPR result -> routed into parking domain.
  const plate = `T${suffix % 1000}ABC`;
  const anpr = await api('/device-api/events', {
    method: 'POST',
    key: deviceKey,
    body: {
      events: [
        {
          type: 'ANPR_RESULT',
          capturedAt: new Date().toISOString(),
          payload: { siteId: 'site-hq', plateNumber: plate, confidence: 0.97, cameraId: 'cam-1' },
        },
      ],
    },
  });
  check('ANPR ingest routed=1', data(anpr)?.routed === 1, `body=${JSON.stringify(anpr.json)}`);

  const anprList = await api('/parking/anpr-results', { token });
  const foundPlate = (data(anprList) ?? []).some((a) => a.plateNumber === plate);
  check('ANPR visible in parking domain', foundPlate, `status=${anprList.status}`);

  // 8) Gateway-forwarded event for the USB device (deviceCode required).
  const gwIng = await api('/device-api/events', {
    method: 'POST',
    gatewayKey,
    body: {
      events: [
        {
          type: 'FINGERPRINT_SCAN',
          capturedAt: new Date().toISOString(),
          deviceCode: `FP-${suffix}`,
          payload: { templateId: 'tpl-9', score: 92 },
        },
      ],
    },
  });
  check('gateway-forwarded event accepted', data(gwIng)?.accepted === 1, `body=${JSON.stringify(gwIng.json)}`);

  // 9) Command lifecycle: admin issues -> gateway polls -> gateway acks.
  const cmd = await api(`/devices/${fpId}/commands`, {
    method: 'POST',
    token,
    body: { type: 'ENROLL_FINGERPRINT', payload: { employeeId: 'emp-42' } },
  });
  const cmdId = data(cmd)?.id;
  check('issue enroll command', !!cmdId, `status=${cmd.status}`);

  const poll = await api('/device-api/commands', { gatewayKey });
  const polled = (data(poll)?.commands ?? []).find((c) => c.id === cmdId);
  check('gateway polls the command', !!polled, `body=${JSON.stringify(poll.json)}`);

  const ack = await api(`/device-api/commands/${cmdId}/ack`, {
    method: 'POST',
    gatewayKey,
    body: { status: 'ACKED', result: { enrolled: true } },
  });
  check('ack command ACKED', data(ack)?.status === 'ACKED', `body=${JSON.stringify(ack.json)}`);

  // 10) Device detail reflects processed events + zero pending commands.
  const detail = await api(`/devices/${fpId}`, { token });
  check('device detail: pendingCommands=0', data(detail)?.pendingCommands === 0, `body=${JSON.stringify(detail.json)}`);
  check('device detail: eventCount>=1', (data(detail)?.eventCount ?? 0) >= 1);

  // 11) Bad device key rejected.
  const bad = await api('/device-api/heartbeat', { method: 'POST', key: 'dvc_invalid', body: {} });
  check('invalid device key -> 401', bad.status === 401, `status=${bad.status}`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
