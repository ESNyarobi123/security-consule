import { createHmac } from 'crypto';

const BASE = `http://localhost:${process.env.CORE_API_PORT ?? 4001}/api/v1`;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32decode(input) {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  let bits = 0, value = 0; const bytes = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(bytes);
}
function totp(secret) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const h = createHmac('sha1', b32decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | ((h[o+1] & 0xff) << 16) | ((h[o+2] & 0xff) << 8) | (h[o+3] & 0xff);
  return (bin % 1e6).toString().padStart(6, '0');
}
async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
const errCode = (r) => r.json?.error?.code;
const ok = (c, m) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);

let fails = 0;
const check = (c, m) => { ok(c, m); if (!c) fails++; };

// 1. login
let r = await api('/auth/login', { method: 'POST', body: { email: 'admin@highlink.co.tz', password: 'ChangeMe123!' } });
check(r.status === 200 || r.status === 201, `login → ${r.status}`);
const token = r.json?.data?.tokens?.accessToken;
check(!!token, 'received access token');

// 2. roles + permissions
r = await api('/roles', { token });
check(r.status === 200 && Array.isArray(r.json?.data), `GET /roles → ${r.status} (${r.json?.data?.length} roles)`);
r = await api('/roles/permissions', { token });
check(r.status === 200 && Array.isArray(r.json?.data), `GET /roles/permissions → ${r.status} (${r.json?.data?.length} perms)`);

// 3. weak password rejected on user create (8 chars passes DTO, fails policy)
r = await api('/users', { method: 'POST', token, body: { email: `weak_${Date.now()}@t.co`, password: 'password', fullName: 'X', roleCodes: [] } });
check(r.status === 400 && errCode(r) === 'WEAK_PASSWORD', `weak password rejected → ${r.status} ${errCode(r) || ''}`);

// 4. MFA setup
r = await api('/auth/mfa/setup', { method: 'POST', token });
const secret = r.json?.data?.secret;
check(r.status === 200 || r.status === 201, `mfa/setup → ${r.status}`);
check(!!secret && r.json?.data?.otpauthUri?.startsWith('otpauth://'), 'got secret + otpauth URI');

// 5. enable with wrong code fails
r = await api('/auth/mfa/enable', { method: 'POST', token, body: { code: '000000' } });
check(r.status === 400 && errCode(r) === 'MFA_INVALID_CODE', `enable wrong code rejected → ${r.status} ${errCode(r) || ''}`);

// 6. enable with correct code
r = await api('/auth/mfa/enable', { method: 'POST', token, body: { code: totp(secret) } });
check((r.status === 200 || r.status === 201) && r.json?.data?.mfaEnabled === true, `enable correct code → ${r.status} mfaEnabled=${r.json?.data?.mfaEnabled}`);

// 7. login now requires MFA
r = await api('/auth/login', { method: 'POST', body: { email: 'admin@highlink.co.tz', password: 'ChangeMe123!' } });
check(r.status === 401 && errCode(r) === 'MFA_REQUIRED', `login without code → ${r.status} ${errCode(r) || ''}`);

// 8. login with MFA code
r = await api('/auth/login', { method: 'POST', body: { email: 'admin@highlink.co.tz', password: 'ChangeMe123!', mfaCode: totp(secret) } });
check((r.status === 200 || r.status === 201) && !!r.json?.data?.tokens?.accessToken, `login with code → ${r.status}`);
const token2 = r.json?.data?.tokens?.accessToken;

// 9. disable MFA (cleanup so admin login is normal again)
r = await api('/auth/mfa/disable', { method: 'POST', token: token2, body: { code: totp(secret) } });
check((r.status === 200 || r.status === 201) && r.json?.data?.mfaEnabled === false, `mfa/disable → ${r.status} mfaEnabled=${r.json?.data?.mfaEnabled}`);

// 10. login back to normal (no code)
r = await api('/auth/login', { method: 'POST', body: { email: 'admin@highlink.co.tz', password: 'ChangeMe123!' } });
check(r.status === 200 || r.status === 201, `login normal after disable → ${r.status}`);

console.log(fails === 0 ? '\nALL PASS ✅' : `\n${fails} FAILED ❌`);
process.exit(fails === 0 ? 0 : 1);
