'use client';

import { customerLogin } from '@pssms/api-client';
import { setCustomerSession } from '@pssms/auth';
import { customerDefaultPath } from '@pssms/permissions';
import { Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('portal@demo-mfg.co.tz');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const msg = new URLSearchParams(window.location.search).get('error');
    if (msg) setError(msg);
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

  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#071526] via-[#0b1f3a] to-[#0d9488]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, #5eead4 0, transparent 35%), radial-gradient(circle at 80% 20%, #38bdf8 0, transparent 30%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center gap-10 px-4 py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <div className="max-w-lg text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-100 backdrop-blur">
            <Shield className="h-3.5 w-3.5" />
            Portal 35.8 · 35.9
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            HIGHLINK
            <span className="block text-teal-200">Customer Access</span>
          </h1>
          <p className="mt-4 text-base text-slate-200/90">
            Customer admins see contracts and site ops; staff use My access for
            their own entry profile — scoped to your organisation only.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            <li>• Access issued by HIGHLINK — no self-signup</li>
            <li>• Customer A never sees Customer B data</li>
            <li>• Staff access is separate from HIGHLINK guards</li>
          </ul>
        </div>

        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0078d4]">
            Sign in
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#1b1a19]">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-[#605e5c]">
            Use the credentials issued by HIGHLINK.
          </p>

          <label className="mt-6 block text-sm font-medium text-[#323130]">
            Email / username
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#c8c6c4] bg-white px-3.5 py-2.5 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/25"
              required
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-[#323130]">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#c8c6c4] bg-white px-3.5 py-2.5 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/25"
              required
            />
          </label>

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#0078d4] to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/10 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Enter portal'}
          </button>

          <div className="mt-5 space-y-2 rounded-xl bg-[#f3f9fd] px-3 py-2.5 text-[11px] text-[#004578]">
            <p className="font-semibold">Demo access</p>
            <p className="mt-0.5 font-mono">portal@demo-mfg.co.tz</p>
            <p className="text-[#605e5c]">Admin · Portal 35.8</p>
            <p className="mt-1.5 font-mono">jane.doe@demo-mfg.co.tz</p>
            <p className="text-[#605e5c]">Staff · Portal 35.9 My access</p>
            <p className="mt-1 font-mono">ChangeMe123!</p>
            <p className="text-[#605e5c]">→ Demo Manufacturing Ltd (CUST-DEMO)</p>
          </div>
        </form>
      </div>
    </div>
  );
}
