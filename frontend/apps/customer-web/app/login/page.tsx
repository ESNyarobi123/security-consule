'use client';

import { customerLogin } from '@pssms/api-client';
import { setCustomerSession } from '@pssms/auth';
import { customerDefaultPath } from '@pssms/permissions';
import {
  AlertTriangle,
  Building2,
  Car,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileText,
  IdCard,
  Lock,
  Mail,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const HIGHLIGHTS = [
  {
    Icon: FileText,
    title: 'Contracts & invoices',
    body: 'Agreements, billing status, and documents — your org only.',
  },
  {
    Icon: Shield,
    title: 'Guards & attendance',
    body: 'Deployed officers and site coverage for your locations.',
  },
  {
    Icon: Users,
    title: 'Visitors & staff access',
    body: 'Host approvals, gate visits, and employee entry profiles.',
  },
  {
    Icon: Car,
    title: 'Payroll, parking & SLA',
    body: 'Customer payroll, parking, incidents, and live SLA vs contract — your org only.',
  },
] as const;

const DEMO_ACCOUNTS = [
  {
    role: 'Admin · Portal 35.8',
    email: 'portal@demo-mfg.co.tz',
    hint: 'Admins, HR, security, finance, management',
  },
  {
    role: 'Staff · Portal 35.9',
    email: 'jane.doe@demo-mfg.co.tz',
    hint: 'My access only',
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('portal@demo-mfg.co.tz');
  const [password, setPassword] = useState('ChangeMe123!');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const msg = params.get('error');
    if (msg) setError(msg);
    if (params.get('registered') === '1') {
      setNotice('Access registered. Sign in with your email and password.');
    }
    try {
      const saved = localStorage.getItem('pssms_customer_last_email');
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await customerLogin(email, password);
      if (!result.user.customerId) {
        throw new Error(
          'This account is not linked to a customer organisation. Use the Customer Portal invite login, not an internal HIGHLINK account.',
        );
      }
      setCustomerSession(
        result.tokens.accessToken,
        result.user,
        result.tokens.refreshToken,
      );
      if (remember) {
        try {
          localStorage.setItem('pssms_customer_last_email', email);
        } catch {
          /* ignore */
        }
      }
      if (result.user.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push(customerDefaultPath(result.user));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('ChangeMe123!');
    setError(null);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row">
      {/* Preline-style onboarding sidebar */}
      <aside className="relative flex flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#071525] via-[#0b1f3a] to-[#0e7490] px-8 py-10 text-white sm:px-12 lg:max-w-[48%] lg:px-14 lg:py-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 22%, rgba(56,189,248,0.35), transparent 42%), radial-gradient(circle at 88% 78%, rgba(13,148,136,0.28), transparent 38%)',
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
              <Building2 className="h-6 w-6 text-teal-200" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">
                HIGHLINK · Portal 35.8 · 35.9
              </p>
              <p className="text-lg font-semibold tracking-tight">
                Customer Portal
              </p>
            </div>
          </div>

          <h1 className="mt-10 max-w-md text-4xl font-semibold leading-tight tracking-tight sm:text-[2.65rem]">
            Your security services,{' '}
            <span className="text-teal-300">one secure workspace</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300">
            Customer administrators, HR, security, finance, and management share
            one organisation login. Each customer sees only its own contracts,
            invoices, guards, attendance, visitors, parking, payroll, and SLA.
            Staff with a My access invite open their own entry profile.
          </p>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ Icon, title, body }) => (
              <li
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:bg-white/10"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-400/15 text-teal-200 ring-1 ring-teal-300/25">
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
            <IdCard className="h-3.5 w-3.5 text-teal-300" />
            Invite-only · no self-signup
          </span>
          <span className="hidden h-3 w-px bg-white/20 sm:block" />
          <span>Customer A never sees Customer B</span>
        </div>
      </aside>

      {/* Auth form panel */}
      <main className="relative flex flex-1 items-center justify-center bg-[#f3f6fb] px-6 py-12 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at top right, rgba(0,120,212,0.08), transparent 50%), radial-gradient(ellipse at bottom left, rgba(13,148,136,0.07), transparent 45%)',
          }}
        />

        <div className="relative z-10 w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0078d4]">
              Portal 35.8 · Customer
            </p>
            <h2 className="mt-1 text-3xl font-semibold text-slate-900">
              Sign in
            </h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_-24px_rgba(18,38,63,0.45)]">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-7 py-6">
              <p className="hidden text-xs font-bold uppercase tracking-[0.18em] text-[#0078d4] lg:block">
                Welcome back
              </p>
              <h2 className="hidden text-3xl font-semibold tracking-tight text-slate-900 lg:block">
                Sign in to portal
              </h2>
              <p className="mt-1 text-base text-slate-500 lg:mt-2">
                Customer administrators and employees — your organisation only.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5 px-7 py-7">
              <div>
                <label
                  htmlFor="customer-email"
                  className="mb-1.5 block text-base font-medium text-slate-700"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="customer-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourcompany.co.tz"
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/25"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="customer-password"
                    className="block text-base font-medium text-slate-700"
                  >
                    Password
                  </label>
                  <span className="text-xs text-slate-400">Issued by HIGHLINK</span>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="customer-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/25"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
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

              <label className="flex cursor-pointer items-center gap-2.5 text-base text-slate-500">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-400 text-[#0078d4] focus:ring-[#0078d4]"
                />
                Remember email on this device
              </label>

              {notice ? (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3 text-sm text-teal-900">
                  {notice}
                </div>
              ) : null}
              {error ? (
                <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <p>{error}</p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0078d4] px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#106ebe] focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Continue to portal
                    <ClipboardCheck className="h-4 w-4 opacity-90" />
                  </>
                )}
              </button>
              <p className="text-center text-sm text-slate-500">
                Employee on the roster?{' '}
                <Link href="/register" className="font-semibold text-[#0078d4]">
                  Register access
                </Link>
              </p>
            </form>

            <div className="border-t border-slate-100 bg-slate-50/80 px-7 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Demo access · CUST-DEMO
              </p>
              <div className="mt-3 grid gap-2">
                {DEMO_ACCOUNTS.map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => fillDemo(demo.email)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-[#0078d4]/40 hover:bg-sky-50/60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        {demo.role}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-slate-500">
                        {demo.email}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-[#0078d4]">
                      Use
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Password{' '}
                <span className="font-mono font-medium text-slate-700">
                  ChangeMe123!
                </span>{' '}
                · Demo Manufacturing Ltd
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-sm leading-relaxed text-slate-400">
            Access issued by HIGHLINK · employee entry is separate from guards
          </p>
        </div>
      </main>
    </div>
  );
}
