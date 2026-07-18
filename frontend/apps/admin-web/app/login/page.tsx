'use client';

import { getOidcConfig, login, type OidcPublicConfig } from '@pssms/api-client';
import {
  buildAuthorizeUrl,
  createPkcePair,
  defaultOidcRedirectUri,
  setSession,
  storePkceSession,
} from '@pssms/auth';
import { defaultPortal } from '@pssms/permissions';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState, type ReactNode } from 'react';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073c0 6.025 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.428c0-3.014 1.792-4.678 4.533-4.678 1.313 0 2.686.235 2.686.235v2.965H15.83c-1.49 0-1.955.93-1.955 1.884v2.263h3.328l-.532 3.49h-2.796v8.437C19.612 23.094 24 18.099 24 12.073z"
      />
    </svg>
  );
}

function SocialComingSoonButton({
  label,
  icon,
}: {
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon — not activated yet"
      className="relative flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-[#e1dfdd] bg-white text-sm font-medium text-[#605e5c] transition disabled:cursor-not-allowed"
    >
      {icon}
      <span>{label}</span>
      <span className="absolute -right-1.5 -top-2 rounded-full bg-[#fff4ce] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8a6d00]">
        Soon
      </span>
    </button>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('admin@highlink.co.tz');
  const [password, setPassword] = useState('ChangeMe123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [oidc, setOidc] = useState<OidcPublicConfig | null>(null);
  const [oidcError, setOidcError] = useState<string | null>(null);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      setError(decodeURIComponent(err.replace(/\+/g, ' ')));
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    getOidcConfig()
      .then((cfg) => {
        if (!cancelled) setOidc(cfg);
      })
      .catch((err) => {
        if (!cancelled) {
          setOidcError(
            err instanceof Error ? err.message : 'OIDC discovery failed',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showLocal = oidc?.localLoginEnabled !== false;
  const showSso =
    oidc != null &&
    (oidc.authMode === 'dual' || oidc.authMode === 'keycloak') &&
    !!oidc.authorizationEndpoint &&
    !!oidc.clients.adminWeb;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login(email, password);
      setSession(
        result.tokens.accessToken,
        result.user,
        result.tokens.refreshToken,
      );
      router.push(defaultPortal(result.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function onSso() {
    if (!oidc?.authorizationEndpoint || !oidc.clients.adminWeb) {
      setError('SSO is not configured');
      return;
    }
    setSsoLoading(true);
    setError(null);
    try {
      const { verifier, challenge } = await createPkcePair();
      const state = crypto.randomUUID();
      storePkceSession(verifier, state);
      const url = buildAuthorizeUrl({
        authorizationEndpoint: oidc.authorizationEndpoint,
        clientId: oidc.clients.adminWeb,
        redirectUri: defaultOidcRedirectUri(),
        state,
        challenge,
      });
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SSO start failed');
      setSsoLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white text-[#323130]">
      {/* Brand panel */}
      <div className="az-brand relative hidden w-[46%] max-w-[620px] flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div aria-hidden className="az-brand-grid" />
        <div aria-hidden className="az-brand-orb az-brand-orb-a" />
        <div aria-hidden className="az-brand-orb az-brand-orb-b" />

        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-base font-bold tracking-wide ring-1 ring-white/25 backdrop-blur">
            HL
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">HIGHLINK</p>
            <p className="text-[11px] uppercase tracking-[0.28em] text-sky-200/90">
              Security Console
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-[2rem] font-semibold leading-tight tracking-tight">
            Every guard, contract and site — one console.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-sky-100/80">
            Operations, attendance, payroll, finance, compliance and AI
            surveillance for private security — unified and audit-logged.
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[11px] text-sky-100/70">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]" />
            Systems online
          </span>
          <span>© {new Date().getFullYear()} HIGHLINK PSSMS</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[380px] animate-login-rise">
          <h1 className="sr-only">HIGHLINK Security Console — Sign in</h1>
          {/* Mobile brand mark */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-[#0078d4] text-base font-bold text-white shadow-lg shadow-[#0078d4]/30">
              HL
            </span>
            <p className="text-xl font-semibold tracking-tight text-[#1b1a19]">
              HIGHLINK
            </p>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#0078d4]">
              Security Console
            </p>
          </div>

          <div>
            <h2 className="text-[1.6rem] font-semibold tracking-tight text-[#1b1a19]">
              Sign in
            </h2>
            <p className="mt-1 text-[13.5px] text-[#605e5c]">
              Access your operations console
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <SocialComingSoonButton
              label="Google"
              icon={<GoogleIcon className="h-[18px] w-[18px]" />}
            />
            <SocialComingSoonButton
              label="Facebook"
              icon={<FacebookIcon className="h-[18px] w-[18px]" />}
            />
          </div>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#edebe9]" />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#a19f9d]">
              or email
            </span>
            <span className="h-px flex-1 bg-[#edebe9]" />
          </div>

          {showSso ? (
            <button
              type="button"
              onClick={onSso}
              disabled={ssoLoading}
              className="mb-4 w-full rounded-md border border-[#c7e0f4] bg-[#eff6fc] px-4 py-3 text-sm font-semibold text-[#0067b8] transition hover:bg-[#deecf9] disabled:opacity-60"
            >
              {ssoLoading ? 'Redirecting…' : 'Continue with SSO'}
            </button>
          ) : null}

          {showLocal ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-[12px] font-semibold text-[#323130]"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="name@company.com"
                  className="az-input"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-[12px] font-semibold text-[#323130]"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="az-input pr-14"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c] transition hover:text-[#0078d4]"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-md border-l-4 border-rose-500 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              {oidcError && !oidc ? (
                <p className="text-center text-[11px] text-[#a19f9d]">
                  SSO unavailable — local login still works.
                </p>
              ) : null}

              <button type="submit" disabled={loading} className="az-submit">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Signing in…
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          ) : (
            <>
              {error ? (
                <p className="rounded-md border-l-4 border-rose-500 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
              {!showSso && oidc ? (
                <p className="mt-2 text-center text-sm text-[#605e5c]">
                  SSO required but Keycloak is incomplete.
                </p>
              ) : null}
            </>
          )}

          <p className="mt-7 text-center text-[11px] tracking-wide text-[#a19f9d]">
            Encrypted session · Audit logged
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-[#605e5c]">
          Loading console…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
