// ZKTeco iClock adapter E2E.
// Simulates a real terminal speaking the raw iClock protocol to the
// integration-gateway, which normalizes + forwards to core-api. Verifies the
// full loop: handshake, ATTLOG upload, dedupe, command poll, and result ack.

const CORE = `http://localhost:${process.env.CORE_API_PORT ?? 4011}/api/v1`;
const GW = `http://localhost:${process.env.GATEWAY_PORT ?? 4013}`;
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

async function coreApi(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${CORE}${path}`, {
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

async function iclock(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${GW}${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'text/plain' } : {},
    body,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  console.log(`\niClock E2E  core=${CORE}  gateway=${GW}\n`);
  const suffix = Date.now();
  const SN = `ZK${suffix}`;

  const login = await coreApi('/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = data(login)?.tokens?.accessToken;
  check('login', !!token, `status=${login.status}`);
  if (!token) process.exit(1);

  // Register the terminal (resolved by serial number by the internal API).
  const reg = await coreApi('/devices', {
    method: 'POST',
    token,
    body: {
      code: `TERM-${suffix}`,
      name: 'ZK Biometric Terminal',
      type: 'BIOMETRIC_TERMINAL',
      connection: 'NETWORK',
      serialNumber: SN,
      siteId: 'site-hq',
    },
  });
  const deviceId = data(reg)?.id;
  check('register terminal (serial)', !!deviceId, `status=${reg.status}`);

  // 1) Handshake — device asks for options.
  const hs = await iclock(`/iclock/cdata?SN=${SN}&options=all&pushver=2.4.1`);
  check('handshake returns GET OPTION block', hs.text.includes(`GET OPTION FROM: ${SN}`) && hs.text.includes('Realtime=1'), `body=${hs.text.slice(0, 60)}`);

  // 2) ATTLOG upload (two punches, tab-separated).
  const t1 = '2026-07-18 08:01:10';
  const t2 = '2026-07-18 17:02:20';
  const attlog = `1001\t${t1}\t0\t1\t0\n1002\t${t2}\t1\t1\t0\n`;
  const up = await iclock(`/iclock/cdata?SN=${SN}&table=ATTLOG&Stamp=9999`, {
    method: 'POST',
    body: attlog,
  });
  check('ATTLOG upload → OK: 2', up.text.trim() === 'OK: 2', `body=${up.text}`);

  // 3) Device detail reflects ingested punches + ONLINE.
  const detail1 = await coreApi(`/devices/${deviceId}`, { token });
  check('device eventCount=2 after ATTLOG', data(detail1)?.eventCount === 2, `body=${JSON.stringify(detail1.json)}`);
  check('device status ONLINE', data(detail1)?.status === 'ONLINE');

  // 4) Duplicate upload — dedupeKey drops both, count stays 2.
  const dup = await iclock(`/iclock/cdata?SN=${SN}&table=ATTLOG&Stamp=9999`, {
    method: 'POST',
    body: attlog,
  });
  check('duplicate ATTLOG accepted (OK)', dup.text.startsWith('OK'), `body=${dup.text}`);
  const detail2 = await coreApi(`/devices/${deviceId}`, { token });
  check('eventCount still 2 (dedupe held)', data(detail2)?.eventCount === 2, `count=${data(detail2)?.eventCount}`);

  // 5) Admin queues a command; device polls via getrequest.
  const cmd = await coreApi(`/devices/${deviceId}/commands`, {
    method: 'POST',
    token,
    body: { type: 'SYNC_USERS' },
  });
  const cmdId = data(cmd)?.id;
  check('issue SYNC_USERS command', !!cmdId, `status=${cmd.status}`);

  const poll = await iclock(`/iclock/getrequest?SN=${SN}`);
  check('getrequest returns C:<id>:DATA QUERY USERINFO', poll.text.includes(`C:${cmdId}:DATA QUERY USERINFO`), `body=${poll.text}`);

  // 6) Device reports the result → command marked ACKED.
  const res = await iclock(`/iclock/devicecmd?SN=${SN}`, {
    method: 'POST',
    body: `ID=${cmdId}&Return=0&CMD=DATA`,
  });
  check('devicecmd result → OK', res.text.trim() === 'OK', `body=${res.text}`);

  const cmds = await coreApi(`/devices/${deviceId}/commands`, { token });
  const acked = (data(cmds) ?? []).find((c) => c.id === cmdId);
  check('command status ACKED', acked?.status === 'ACKED', `status=${acked?.status}`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
