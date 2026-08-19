'use client';

import { registerCustomerEmployeeAccess } from '@pssms/api-client';
import { Building2, Eye, EyeOff, IdCard, Lock, Mail, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function RegisterPage() {
  const router = useRouter();
  const [customerCode, setCustomerCode] = useState('CUST-DEMO');
  const [employeeNumber, setEmployeeNumber] = useState('EMP-1003');
  const [email, setEmail] = useState('aisha.hassan@demo-mfg.co.tz');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await registerCustomerEmployeeAccess({
        customerCode,
        employeeNumber,
        email,
        password,
      });
      router.push('/login?registered=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row">
      <aside className="relative flex flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#071525] via-[#0b1f3a] to-[#0e7490] px-8 py-10 text-white sm:px-12 lg:max-w-[48%] lg:px-14 lg:py-14">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/25">
              <IdCard className="h-6 w-6 text-teal-200" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">
                HIGHLINK · Portal 35.9
              </p>
              <p className="text-lg font-semibold tracking-tight">
                Employee access
              </p>
            </div>
          </div>
          <h1 className="mt-10 max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Register for{' '}
            <span className="text-teal-300">your workplace access</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300">
            Your organisation must already have you on the access roster.
            Match customer code, employee number, and work email — then use QR,
            card, biometric, or PIN at approved premises.
          </p>
        </div>
        <p className="relative z-10 mt-12 text-xs text-slate-400">
          Customer A never sees Customer B · not a HIGHLINK guard login
        </p>
      </aside>

      <main className="relative flex flex-1 items-center justify-center bg-[#f3f6fb] px-6 py-12 sm:px-10">
        <div className="relative z-10 w-full max-w-[440px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_-24px_rgba(18,38,63,0.45)]">
            <div className="border-b border-slate-100 px-7 py-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0078d4]">
                Portal 35.9
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                Create your access login
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Does not create a new employee record. Invite from your admin
                still works.
              </p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4 px-7 py-7">
              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {error}
                </p>
              ) : null}
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Customer code</span>
                <span className="relative mt-1 block">
                  <Building2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
                    autoComplete="organization"
                    required
                  />
                </span>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Employee number</span>
                <span className="relative mt-1 block">
                  <Shield className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={employeeNumber}
                    onChange={(e) => setEmployeeNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 font-mono text-sm"
                    required
                  />
                </span>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Work email</span>
                <span className="relative mt-1 block">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
                    autoComplete="email"
                    required
                  />
                </span>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Password</span>
                <span className="relative mt-1 block">
                  <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-10 text-sm"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-2 text-slate-400"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </span>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#0078d4] py-2.5 text-sm font-semibold text-white hover:bg-[#106ebe] disabled:opacity-50"
              >
                {loading ? 'Registering…' : 'Register access'}
              </button>
            </form>
            <p className="border-t border-slate-100 px-7 py-4 text-center text-sm text-slate-500">
              Already invited?{' '}
              <Link href="/login" className="font-semibold text-[#0078d4]">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
