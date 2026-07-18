import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human-readable 8-char code (no ambiguous 0/O, 1/I). */
export function generateVerificationCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return code;
}

export function hashVerificationCode(code: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(code.trim().toUpperCase())
    .digest('hex');
}

export function verifyCodeHash(
  code: string,
  hash: string,
  secret: string,
): boolean {
  const computed = hashVerificationCode(code, secret);
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  } catch {
    return false;
  }
}
