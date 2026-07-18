/** Default duty site for v1 demos (must match seed `SITE-WAREHOUSE-A`). */
export const DEMO_SITE_CODE = 'SITE-WAREHOUSE-A';

export const DEFAULT_LOGIN = {
  email: 'supervisor1@highlink.co.tz',
  password: 'ChangeMe123!',
} as const;

export const SITE_CACHE_KEY = 'pssms.supervisor.site.SITE-WAREHOUSE-A';

/** Live board poll interval when online. */
export const BOARD_POLL_MS = 20_000;

export function getApiBase(): string {
  const base = process.env.EXPO_PUBLIC_API_BASE;
  if (base && base.length > 0) return base.replace(/\/$/, '');
  return 'http://localhost:4001/api/v1';
}
