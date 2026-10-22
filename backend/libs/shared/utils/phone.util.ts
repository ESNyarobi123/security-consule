/**
 * Phone normalisation for SMS / WhatsApp delivery.
 *
 * PSSMS is a Tanzanian operator, so bare local numbers default to +255.
 * Everything that leaves the platform (notification recipient, integration
 * request log, provider payload) must be E.164 so vendors accept it.
 */

export const DEFAULT_PHONE_COUNTRY_CODE = '255';

/** Keep digits only, tolerating spaces, dashes, dots, parentheses and "+". */
export function normalisePhone(
  raw: string | null | undefined,
  countryCode: string = DEFAULT_PHONE_COUNTRY_CODE,
): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  // "00" international prefix → drop it (0044… → 44…)
  const compact = value.replace(/[^\d+]/g, '');
  let digits = compact.replace(/^\+/, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits) return null;

  const cc = countryCode.replace(/\D/g, '');

  if (compact.startsWith('+')) {
    // Already international.
  } else if (digits.startsWith('0') && digits.length >= 9) {
    // 0712 345 678 → 255712345678
    digits = `${cc}${digits.replace(/^0+/, '')}`;
  } else if (digits.length === 9) {
    // 712 345 678 → 255712345678
    digits = `${cc}${digits}`;
  } else if (!digits.startsWith(cc) && digits.length <= 12) {
    // 712345678 already handled; anything short is most likely local.
    digits = `${cc}${digits.replace(/^0+/, '')}`;
  }

  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function isValidPhone(
  raw: string | null | undefined,
  countryCode: string = DEFAULT_PHONE_COUNTRY_CODE,
): boolean {
  return normalisePhone(raw, countryCode) !== null;
}

/** Provider-safe (no "+") form used by Beem / NextSMS style APIs. */
export function phoneWithoutPlus(phone: string): string {
  return phone.replace(/^\+/, '');
}

/** Never log a full visitor number — keep the country code and last 3 digits. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 5) return '***';
  return `+${digits.slice(0, Math.min(3, digits.length - 3))}***${digits.slice(-3)}`;
}
