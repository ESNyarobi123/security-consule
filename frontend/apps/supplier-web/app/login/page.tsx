'use client';

import { supplierLogin } from '@pssms/api-client';
import { setSupplierSession } from '@pssms/auth';
import { Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('portal@uniforms.co.tz');
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
      const result = await supplierLogin(email, password);
      setSupplierSession(result.tokens.accessToken, result.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#071526] via-[#0b1f3a] to-[#9a3412]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, #fdba74 0, transparent 35%), radial-gradient(circle at 80% 20%, #38bdf8 0, transparent 30%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center gap-10 px-4 py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <div className="max-w-lg text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100 backdrop-blur">
            <Package className="h-3.5 w-3.5" />
            Portal 35.17
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            HIGHLINK
            <span className="block text-amber-200">Supplier Access</span>
          </h1>
          <p className="mt-4 text-base text-slate-200/90">
            View your company profile and purchase orders issued by HIGHLINK —
            scoped to your supplier account only.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            <li>• Access issued by HIGHLINK procurement</li>
            <li>• You only see your own POs and profile</li>
            <li>• Quotes, delivery & payment status come next</li>
          </ul>
        </div>

        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ea580c]">
            Sign in
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#1b1a19]">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-[#605e5c]">
            Use the credentials from your supplier invite.
          </p>

          <label className="mt-6 block text-sm font-medium text-[#323130]">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#c8c6c4] bg-white px-3.5 py-2.5 text-[#1b1a19] outline-none transition focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20"
              required
              autoComplete="username"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-[#323130]">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#c8c6c4] bg-white px-3.5 py-2.5 text-[#1b1a19] outline-none transition focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20"
              required
              autoComplete="current-password"
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
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#ea580c] to-[#c2410c] px-4 py-3 font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Continue to portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
