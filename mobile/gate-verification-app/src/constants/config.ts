/** Default duty site for v1 demos (must match seed `SITE-WAREHOUSE-A`). */
export const DEMO_SITE_CODE = 'SITE-WAREHOUSE-A';

/** Demo gate codes on SITE-WAREHOUSE-A. */
export const DEMO_GATE_CODES = ['GATE-MAIN', 'GATE-VEHICLE'] as const;

export const DEFAULT_LOGIN = {
  email: 'gate1@highlink.co.tz',
  password: 'ChangeMe123!',
} as const;

export const ADMIN_LOGIN_FALLBACK =
  'If gate1 is not seeded yet, sign in as admin@highlink.co.tz / ChangeMe123!';

export const SITE_CACHE_KEY = 'pssms.gate.site.SITE-WAREHOUSE-A';
export const GATE_SELECTION_KEY = 'pssms.gate.selectedGateCode';

export function getApiBase(): string {
  const base = process.env.EXPO_PUBLIC_API_BASE;
  if (base && base.length > 0) return base.replace(/\/$/, '');
  return 'http://localhost:4001/api/v1';
}
