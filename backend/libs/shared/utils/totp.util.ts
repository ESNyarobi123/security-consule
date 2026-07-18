import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * RFC 6238 TOTP / RFC 4226 HOTP implemented on Node crypto (no third-party dep).
 * Compatible with Google Authenticator, Authy, Microsoft Authenticator, etc.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error('Invalid base32 character in TOTP secret');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generate a new base32-encoded shared secret (default 20 bytes / 160 bits). */
export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  // 53-bit safe write of the counter as big-endian 64-bit.
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/** Current TOTP code for a base32 secret. */
export function generateTotp(
  base32Secret: string,
  opts: { step?: number; digits?: number; timestamp?: number } = {},
): string {
  const step = opts.step ?? 30;
  const digits = opts.digits ?? 6;
  const timestamp = opts.timestamp ?? Date.now();
  const counter = Math.floor(timestamp / 1000 / step);
  return hotp(base32Decode(base32Secret), counter, digits);
}

/**
 * Verify a submitted token against the secret, allowing +/- `window` steps
 * to tolerate clock drift. Uses constant-time comparison.
 */
export function verifyTotp(
  base32Secret: string,
  token: string,
  opts: { step?: number; digits?: number; window?: number; timestamp?: number } = {},
): boolean {
  const step = opts.step ?? 30;
  const digits = opts.digits ?? 6;
  const window = opts.window ?? 1;
  const timestamp = opts.timestamp ?? Date.now();
  const cleaned = (token ?? '').replace(/\s+/g, '');
  if (!/^\d{6,8}$/.test(cleaned)) {
    return false;
  }
  const secret = base32Decode(base32Secret);
  const baseCounter = Math.floor(timestamp / 1000 / step);
  for (let i = -window; i <= window; i += 1) {
    const candidate = hotp(secret, baseCounter + i, digits);
    if (
      candidate.length === cleaned.length &&
      timingSafeEqual(Buffer.from(candidate), Buffer.from(cleaned))
    ) {
      return true;
    }
  }
  return false;
}

/** Build an otpauth:// provisioning URI (rendered as a QR code by the client). */
export function buildOtpAuthUri(params: {
  secret: string;
  accountName: string;
  issuer: string;
  digits?: number;
  step?: number;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(params.digits ?? 6),
    period: String(params.step ?? 30),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
