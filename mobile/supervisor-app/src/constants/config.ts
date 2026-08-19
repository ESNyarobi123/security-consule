export const DEFAULT_LOGIN = {
  email: 'supervisor1@highlink.co.tz',
  password: 'ChangeMe123!',
} as const;

/** Last selected duty site (JWT-scoped list from GET /enterprise/sites). */
export const SELECTED_SITE_KEY = 'pssms.supervisor.selectedSiteId';

/** Live board poll interval when online. */
export const BOARD_POLL_MS = 20_000;

export function getApiBase(): string {
  const base = process.env.EXPO_PUBLIC_API_BASE;
  if (base && base.length > 0) return base.replace(/\/$/, '');
  return 'http://localhost:4001/api/v1';
}
