/**
 * OIDC Authorization Code + PKCE (S256) helpers for browser public clients.
 * Verifier/state live in sessionStorage (tab-scoped, ephemeral) — KeycloakPro / RFC 7636 guidance.
 */

const VERIFIER_KEY = 'pssms_oidc_verifier';
const STATE_KEY = 'pssms_oidc_state';
const REFRESH_KEY = 'pssms_oidc_refresh';

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createPkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  // RFC 7636: verifier 43–128 chars; 32 random bytes → ~43 base64url chars
  const verifier = randomString(32);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64UrlEncode(digest) };
}

export function storePkceSession(verifier: string, state: string): void {
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
}

export function takePkceSession(): { verifier: string; state: string } | null {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const state = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!verifier || !state) return null;
  return { verifier, state };
}

export function storeOidcRefresh(refreshToken: string): void {
  sessionStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearOidcRefresh(): void {
  sessionStorage.removeItem(REFRESH_KEY);
}

export function buildAuthorizeUrl(args: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  scope?: string;
}): string {
  const url = new URL(args.authorizationEndpoint);
  url.searchParams.set('client_id', args.clientId);
  url.searchParams.set('redirect_uri', args.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', args.scope ?? 'openid email profile');
  url.searchParams.set('state', args.state);
  url.searchParams.set('code_challenge', args.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export type OidcTokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
};

export async function exchangeAuthorizationCode(args: {
  tokenEndpoint: string;
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: args.clientId,
    code: args.code,
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier,
  });
  const res = await fetch(args.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as OidcTokenResponse;
}

export function defaultOidcRedirectUri(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI ??
      'http://localhost:3000/auth/callback'
    );
  }
  return (
    process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI ??
    `${window.location.origin}/auth/callback`
  );
}
