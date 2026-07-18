/** Default duty site for v1 demos (must match seed `SITE-WAREHOUSE-A`). */
export const DEMO_SITE_CODE = 'SITE-WAREHOUSE-A';

/** Demo checkpoint QR/code (must match seed `CP-GATE-01`). */
export const DEMO_CHECKPOINT_QR = 'CP-GATE-01';

/** Demo GPS near Dar es Salaam warehouse (v1 — no live geolocation). */
export const DEMO_GPS = {
  latitude: -6.7924,
  longitude: 39.2083,
} as const;

export const DEFAULT_LOGIN = {
  email: 'guard1@highlink.co.tz',
  password: 'ChangeMe123!',
} as const;

export const SITE_CACHE_KEY = 'pssms.guard.site.SITE-WAREHOUSE-A';

/**
 * Device clock is for offline sync audit only.
 * Payroll uses server-verified hours — never show deviceTime as pay truth.
 */
export const DEVICE_TIME_DISCLAIMER =
  'deviceTime is recorded for sync audit only. Payroll uses server-verified hours.';

export function getApiBase(): string {
  const base = process.env.EXPO_PUBLIC_API_BASE;
  if (base && base.length > 0) return base.replace(/\/$/, '');
  return 'http://localhost:4001/api/v1';
}
