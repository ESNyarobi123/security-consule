/**
 * Shared session-aware fetch for the portal API clients.
 *
 * Every portal talks to the same core API with a 15-minute access token. Any
 * module that forged its own `fetch` (instead of this helper) surfaced a bare
 * "Unauthorized" banner the moment the token aged out — the operator saw a
 * broken page even though a refresh token was still on the device.
 *
 * `createSessionFetch` gives a portal:
 *   - the caller's bearer token,
 *   - one single-flight `POST /auth/refresh` + retry on the first 401,
 *   - a clean redirect to the portal's login when the refresh token is dead.
 */
import { ApiEnvelope, parseApiEnvelope } from './errors';

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4001';

export type SessionFetchConfig = {
  /** Unique per portal audience — refreshes are single-flight per key. */
  key: string;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearSession: () => void;
  /** Login route for this portal, e.g. `/login` or `/contractor/login`. */
  loginPath: string;
  /** Optional auth header builder (defaults to `Authorization: Bearer`). */
  authHeader?: (token: string) => HeadersInit;
};

type RefreshBody = {
  accessToken: string;
  refreshToken: string;
};

const inflight = new Map<string, Promise<string | null>>();

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

/** Send the operator to sign-in once the refresh token itself is rejected. */
function forceLogin(cfg: SessionFetchConfig) {
  if (typeof window === 'undefined') return;
  cfg.clearSession();
  const { pathname } = window.location;
  if (pathname.startsWith(cfg.loginPath)) return;
  window.location.assign(`${cfg.loginPath}?expired=1`);
}

async function refreshSession(cfg: SessionFetchConfig): Promise<string | null> {
  const refreshToken = cfg.getRefreshToken();
  if (!refreshToken) return null;
  const existing = inflight.get(cfg.key);
  if (existing) return existing;
  const run = (async () => {
    try {
      const res = await fetch(`${coreUrl()}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as ApiEnvelope<RefreshBody>;
      const next = json?.data;
      if (!next?.accessToken) return null;
      cfg.setTokens(next.accessToken, next.refreshToken ?? refreshToken);
      return next.accessToken;
    } catch {
      return null;
    } finally {
      setTimeout(() => inflight.delete(cfg.key), 0);
    }
  })();
  inflight.set(cfg.key, run);
  return run;
}

/**
 * Returns a typed JSON fetch bound to one portal session.
 *
 * `init.token` takes precedence (public/anonymous calls pass it explicitly) and
 * disables the refresh-retry path, exactly like the old per-module helpers.
 */
export function createSessionFetch(cfg: SessionFetchConfig) {
  async function request<T>(
    path: string,
    init?: RequestInit & { token?: string },
  ): Promise<T> {
    const method = (init?.method ?? 'GET').toUpperCase();
    // Action endpoints (approve, submit, reset…) take no body. Sending `{}`
    // avoids Fastify's "Body cannot be empty" when a JSON content-type is set.
    const bodylessMutation =
      init?.body == null && ['POST', 'PUT', 'PATCH'].includes(method);
    const requestInit: RequestInit = bodylessMutation
      ? { ...init, body: '{}' }
      : (init ?? {});
    const buildHeaders = (token?: string | null): HeadersInit => ({
      ...(requestInit.body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? (cfg.authHeader ?? bearer)(token) : {}),
      ...init?.headers,
    });
    const send = (token?: string | null) =>
      fetch(`${coreUrl()}${path}`, {
        ...requestInit,
        headers: buildHeaders(token),
      });

    const explicit = init?.token ?? null;
    let res = await send(explicit ?? cfg.getAccessToken());

    if (res.status === 401 && !explicit) {
      const next = await refreshSession(cfg);
      if (next) res = await send(next);
      if (res.status === 401) forceLogin(cfg);
    }
    return parseApiEnvelope<T>(res);
  }

  return {
    request,
    refresh: () => refreshSession(cfg),
    expire: () => forceLogin(cfg),
  };
}
