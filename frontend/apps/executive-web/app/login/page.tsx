'use client';

import { login } from '@pssms/api-client';
import { AZURE } from '@pssms/ui';
import { REFRESH_KEY, TOKEN_KEY, USER_KEY } from '@/lib/auth';
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Building2,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  Mail,
  Shield,
  Users,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';

const HIGHLIGHTS = [
  {
    Icon: BarChart3,
    title: 'Company-wide KPIs',
    body: 'Ops, finance, payroll, and safety in one board view.',
  },
  {
    Icon: Building2,
    title: 'Branches & sites',
    body: 'Nationwide footprint performance at a glance.',
  },
  {
    Icon: Briefcase,
    title: 'Customers & contracts',
    body: 'Commercial health, MRR, and outstanding invoices.',
  },
  {
    Icon: Shield,
    title: 'Risk & compliance',
    body: 'Incidents, alerts, and audit-ready signals.',
  },
] as const;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get('reason');
  const [email, setEmail] = useState('ceo@highlink.co.tz');
  const [password, setPassword] = useState('ChangeMe123!');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login(email, password);
      sessionStorage.setItem(TOKEN_KEY, result.tokens.accessToken);
      sessionStorage.setItem(REFRESH_KEY, result.tokens.refreshToken);
      sessionStorage.setItem(USER_KEY, JSON.stringify(result.user));
      if (remember) {
        try {
          localStorage.setItem('pssms_exec_last_email', email);
        } catch {
          /* ignore */
        }
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Preline-style onboarding sidebar */}
      <aside
        className="relative flex flex-1 flex-col justify-between overflow-hidden px-8 py-10 text-white sm:px-12 lg:max-w-[48%] lg:px-14 lg:py-14"
        style={{
          background: `linear-gradient(155deg, #071525 0%, ${AZURE.navy} 42%, #0b4f7a 78%, #0e7490 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 22%, rgba(56,189,248,0.35), transparent 42%), radial-gradient(circle at 88% 78%, rgba(16,185,129,0.22), transparent 38%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/25 backdrop-blur">
              <LayoutDashboard className="h-6 w-6 text-sky-200" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
                HIGHLINK · Portal 35.2
              </p>
              <p className="text-lg font-semibold tracking-tight">
                Executive Dashboard
              </p>
            </div>
          </div>

          <h1 className="mt-10 max-w-md text-4xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Company performance,{' '}
            <span className="text-sky-300">one command view</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
            Sign in for CMD, CEO, GM, and Department Heads — live KPIs across
            operations, commercial, finance, and risk.
          </p>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ Icon, title, body }) => (
              <li
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:bg-white/10"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/15 text-sky-200 ring-1 ring-sky-300/20">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 text-base font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 mt-12 flex flex-wrap items-center gap-4 border-t border-white/10 pt-6 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-sky-300" />
            ceo@ · gm@ · cmd@
          </span>
          <span className="hidden h-3 w-px bg-white/20 sm:block" />
          <span>Private Security Services Management System</span>
        </div>
      </aside>

      {/* Auth form panel */}
      <main className="relative flex flex-1 items-center justify-center bg-[#f3f6fb] px-6 py-12 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at top right, rgba(0,120,212,0.08), transparent 50%), radial-gradient(ellipse at bottom left, rgba(14,116,144,0.06), transparent 45%)',
          }}
        />

        <div className="relative z-10 w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0078d4]">
              Portal 35.2 · Executive
            </p>
            <h2 className="mt-1 text-3xl font-semibold text-[#1b1a19]">
              Sign in
            </h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-[0_20px_50px_-24px_rgba(18,38,63,0.45)]">
            <div className="border-b border-[#edebe9] bg-gradient-to-r from-[#f8fafc] to-white px-7 py-6">
              <p className="hidden text-xs font-bold uppercase tracking-[0.18em] text-[#0078d4] lg:block">
                Welcome back
              </p>
              <h2 className="hidden text-3xl font-semibold tracking-tight text-[#1b1a19] lg:block">
                Sign in to Executive
              </h2>
              <p className="mt-1 text-base text-[#605e5c] lg:mt-2">
                Use your executive account — not System Administrator.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5 px-7 py-7">
              {reason === 'session_expired' || reason === 'required' ? (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p>
                    {reason === 'session_expired'
                      ? 'Session expired (access token ~15 min). Sign in again to continue.'
                      : 'Please sign in to open the Executive Dashboard.'}
                  </p>
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="exec-email"
                  className="mb-1.5 block text-base font-medium text-[#323130]"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8886]" />
                  <input
                    id="exec-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ceo@highlink.co.tz"
                    className="w-full rounded-xl border border-[#c8c6c4] bg-white py-3 pl-11 pr-3.5 text-sm text-[#1b1a19] outline-none transition placeholder:text-[#a19f9d] focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/25"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="exec-password"
                    className="block text-base font-medium text-[#323130]"
                  >
                    Password
                  </label>
                  <span className="text-xs text-[#8a8886]">Demo: ChangeMe123!</span>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8886]" />
                  <input
                    id="exec-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-[#c8c6c4] bg-white py-3 pl-11 pr-12 text-sm text-[#1b1a19] outline-none transition placeholder:text-[#a19f9d] focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/25"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#605e5c] transition hover:bg-[#f3f2f1] hover:text-[#323130]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-base text-[#605e5c]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-[#8a8886] text-[#0078d4] focus:ring-[#0078d4]"
                />
                Remember email on this device
              </label>

              {error ? (
                <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <p>{error}</p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0078d4] px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#106ebe] focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Continue to dashboard
                    <LayoutDashboard className="h-4 w-4 opacity-90" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm leading-relaxed text-[#8a8886]">
            Prefer demo accounts{' '}
            <span className="font-medium text-[#605e5c]">ceo@</span>,{' '}
            <span className="font-medium text-[#605e5c]">gm@</span>, or{' '}
            <span className="font-medium text-[#605e5c]">cmd@</span> · HIGHLINK
            PSSMS
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#12263f] text-sm text-slate-300">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
