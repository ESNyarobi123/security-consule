'use client';

import { login } from '@pssms/api-client';
import { AZURE } from '@pssms/ui';
import { REFRESH_KEY, TOKEN_KEY, USER_KEY } from '@/lib/auth';
import { LayoutDashboard } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get('reason');
  const [email, setEmail] = useState('ceo@highlink.co.tz');
  const [password, setPassword] = useState('ChangeMe123!');
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
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: `linear-gradient(145deg, #071525 0%, ${AZURE.navy} 40%, #0e7490 100%)`,
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-white/15 bg-white/95 p-8 shadow-2xl backdrop-blur"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg"
            style={{
              background:
                'linear-gradient(145deg, #34d399 0%, #0078d4 55%, #0e7490 100%)',
            }}
          >
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0078d4]">
              Portal 35.2 · Executive
            </p>
            <h1 className="text-xl font-bold text-[#1b1a19]">Sign in</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-[#605e5c]">
          For CMD, CEO, and General Manager — company-wide KPIs. Prefer{' '}
          <span className="font-medium text-[#323130]">ceo@</span> /{' '}
          <span className="font-medium text-[#323130]">gm@</span> /{' '}
          <span className="font-medium text-[#323130]">cmd@</span> demo
          accounts (not System Administrator).
        </p>

        {reason === 'session_expired' || reason === 'required' ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {reason === 'session_expired'
              ? 'Session expired (access token ~15 min). Sign in again to continue.'
              : 'Please sign in to open the Executive Dashboard.'}
          </p>
        ) : null}

        <label className="mt-6 block text-sm font-medium text-[#605e5c]">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#8a8886] bg-white px-3 py-2.5 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
            required
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-[#605e5c]">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#8a8886] bg-white px-3 py-2.5 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
            required
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-[#0078d4] px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#106ebe] disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Continue to dashboard'}
        </button>
      </form>
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
