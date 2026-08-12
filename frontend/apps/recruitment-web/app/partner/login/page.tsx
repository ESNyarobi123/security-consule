'use client';

import { partnerLogin, registerB2bPartner } from '@pssms/api-client';
import { setPartnerSession } from '@pssms/auth';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ClipboardList,
  Eye,
  EyeOff,
  FileSearch,
  Lock,
  Mail,
  Phone,
  Shield,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { CareersShell } from '../../_components/careers-ui';

const HIGHLIGHTS = [
  {
    Icon: ClipboardList,
    title: 'Guard supply requests',
    body: 'Submit B2B recruitment requests by criteria to HIGHLINK.',
  },
  {
    Icon: FileSearch,
    title: 'Track HR triage',
    body: 'Follow status after HIGHLINK reviews your own requests.',
  },
  {
    Icon: Shield,
    title: 'Own organisation only',
    body: 'You never see another partner’s data or public applicants.',
  },
  {
    Icon: Users,
    title: 'Separate from careers',
    body: 'This is partner access — not the public job application flow.',
  },
] as const;

export default function PartnerLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('partner@demo-security.co.tz');
  const [password, setPassword] = useState('ChangeMe123!');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await partnerLogin(email, password);
      if (
        !result.user.b2bPartnerId ||
        !result.user.roles?.includes('OTHER_SECURITY_COMPANY')
      ) {
        setError(
          'This account is not linked to an other-security-company partner.',
        );
        return;
      }
      if (remember) {
        try {
          localStorage.setItem('pssms_partner_last_email', email);
        } catch {
          /* ignore */
        }
      }
      setPartnerSession(
        result.tokens.accessToken,
        result.user,
        result.tokens.refreshToken,
      );
      router.push('/partner/requests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Password and confirmation do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await registerB2bPartner({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });
      setMode('signin');
      setPassword('');
      setConfirmPassword('');
      setNotice(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setMode('signin');
    setEmail('partner@demo-security.co.tz');
    setPassword('ChangeMe123!');
    setError(null);
    setNotice(null);
  }

  return (
    <CareersShell active="partner">
      <div className="grid min-h-[calc(100dvh-8.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#071525] via-[#0b1f3a] to-[#4f46e5] px-8 py-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 18% 22%, rgba(165,180,252,0.4), transparent 42%), radial-gradient(circle at 88% 78%, rgba(56,189,248,0.22), transparent 38%)',
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
                <Building2 className="h-6 w-6 text-indigo-200" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
                  HIGHLINK · Portal 35.14
                </p>
                <p className="text-lg font-semibold tracking-tight">
                  Other security company
                </p>
              </div>
            </div>

            <h1 className="mt-10 max-w-md text-4xl font-semibold leading-tight tracking-tight">
              Partner access for{' '}
              <span className="text-indigo-200">guard supply requests</span>
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300">
              Register your security company, then sign in. HIGHLINK recruitment
              approves partners before guard supply requests can be submitted.
            </p>

            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {HIGHLIGHTS.map(({ Icon, title, body }) => (
                <li
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:bg-white/10"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-200 ring-1 ring-indigo-300/25">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-base font-semibold text-white">
                    {title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 mt-12 flex flex-wrap items-center gap-4 border-t border-white/10 pt-6 text-xs text-slate-400">
            <span>Self-register · HR approval required</span>
            <span className="hidden h-3 w-px bg-white/20 sm:block" />
            <Link href="/" className="text-indigo-200 hover:text-white">
              Looking for a job? Open careers
            </Link>
          </div>
        </aside>

        <main className="relative flex items-center justify-center bg-[#f8fafc] px-5 py-10 sm:px-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at top right, rgba(79,70,229,0.08), transparent 50%), radial-gradient(ellipse at bottom left, rgba(0,120,212,0.06), transparent 45%)',
            }}
          />

          <div className="relative z-10 w-full max-w-[440px]">
            <div className="mb-8 lg:hidden">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#4f46e5]">
                Portal 35.14 · Partner
              </p>
              <h2 className="mt-1 text-3xl font-semibold text-slate-900">
                Sign in
              </h2>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_-24px_rgba(18,38,63,0.45)]">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-7 py-6">
                <p className="hidden text-xs font-bold uppercase tracking-[0.18em] text-[#4f46e5] lg:block">
                  Portal 35.14
                </p>
                <h2 className="hidden text-3xl font-semibold tracking-tight text-slate-900 lg:block">
                  {mode === 'register' ? 'Register company' : 'Partner sign in'}
                </h2>
                <p className="mt-1 text-base text-slate-500 lg:mt-2">
                  {mode === 'register'
                    ? 'Create a partner account. HIGHLINK must approve before you can request guards.'
                    : 'Sign in to submit and track your own guard supply requests.'}
                </p>
                <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      mode === 'signin'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                      setNotice(null);
                      if (email === 'partner@demo-security.co.tz') {
                        setEmail('');
                        setPassword('');
                      }
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      mode === 'register'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Register
                  </button>
                </div>
              </div>

              {mode === 'register' ? (
                <form onSubmit={onRegister} className="space-y-4 px-7 py-7">
                  <div>
                    <label
                      htmlFor="partner-company"
                      className="mb-1.5 block text-base font-medium text-slate-700"
                    >
                      Company name
                    </label>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="partner-company"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Your security company"
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/25"
                        required
                        minLength={2}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="partner-contact"
                      className="mb-1.5 block text-base font-medium text-slate-700"
                    >
                      Contact person
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="partner-contact"
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Full name"
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/25"
                        required
                        minLength={2}
                        autoComplete="name"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="partner-reg-email"
                      className="mb-1.5 block text-base font-medium text-slate-700"
                    >
                      Work email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="partner-reg-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ops@yourcompany.co.tz"
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/25"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="partner-phone"
                      className="mb-1.5 block text-base font-medium text-slate-700"
                    >
                      Phone{' '}
                      <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="partner-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+255 …"
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/25"
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="partner-reg-password"
                        className="mb-1.5 block text-base font-medium text-slate-700"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="partner-reg-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3.5 text-base text-slate-900 outline-none transition focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/25"
                          required
                          minLength={8}
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="partner-confirm"
                        className="mb-1.5 block text-base font-medium text-slate-700"
                      >
                        Confirm
                      </label>
                      <input
                        id="partner-confirm"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 px-3.5 text-base text-slate-900 outline-none transition focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/25"
                        required
                        minLength={8}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Min 10 characters, with uppercase, lowercase, number and
                    symbol.
                  </p>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      required
                      className="mt-0.5 h-4 w-4 rounded border-slate-400 text-[#4f46e5] focus:ring-[#4f46e5]"
                    />
                    I confirm this is a security company requesting B2B guard
                    supply from HIGHLINK.
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
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Creating account…' : 'Create partner account'}
                    {!loading ? <ArrowRight className="h-4 w-4 opacity-90" /> : null}
                  </button>
                </form>
              ) : (
              <form onSubmit={onSubmit} className="space-y-5 px-7 py-7">
                <div>
                  <label
                    htmlFor="partner-email"
                    className="mb-1.5 block text-base font-medium text-slate-700"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="partner-email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="partner@yourcompany.co.tz"
                      className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/25"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="partner-password"
                      className="block text-base font-medium text-slate-700"
                    >
                      Password
                    </label>
                    <span className="text-xs text-slate-400">
                      Your partner password
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="partner-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/25"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
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
                    className="h-4 w-4 rounded border-slate-400 text-[#4f46e5] focus:ring-[#4f46e5]"
                  />
                  Remember email on this device
                </label>

                {notice ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Continue to requests
                      <ArrowRight className="h-4 w-4 opacity-90" />
                    </>
                  )}
                </button>
              </form>
              )}

              {mode === 'signin' ? (
              <div className="border-t border-slate-100 bg-slate-50/80 px-7 py-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Demo access · OSC-DEMO
                </p>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="mt-3 flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-[#4f46e5]/40 hover:bg-indigo-50/60"
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      Other security company
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-slate-500">
                      partner@demo-security.co.tz
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-[#4f46e5]">
                    Use
                  </span>
                </button>
                <p className="mt-3 text-xs text-slate-500">
                  Password{' '}
                  <span className="font-mono font-medium text-slate-700">
                    ChangeMe123!
                  </span>
                </p>
              </div>
              ) : null}
            </div>

            <p className="mt-6 text-center text-sm leading-relaxed text-slate-400">
              Looking for a job?{' '}
              <Link
                href="/"
                className="font-semibold text-[#4f46e5] hover:underline"
              >
                Open careers
              </Link>
            </p>
          </div>
        </main>
      </div>
    </CareersShell>
  );
}
