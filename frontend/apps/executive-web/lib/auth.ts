export const TOKEN_KEY = 'pssms_executive_token';
export const REFRESH_KEY = 'pssms_executive_refresh';
export const USER_KEY = 'pssms_executive_user';

/** Clear session and send user to login (expired / missing JWT). */
export function clearExecutiveSession() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function isUnauthorizedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & { status?: number; code?: string };
  if (e.status === 401 || e.code === 'UNAUTHORIZED') return true;
  const m = e.message.toLowerCase();
  return m.includes('unauthorized') || m.includes('"code":"unauthorized"');
}
