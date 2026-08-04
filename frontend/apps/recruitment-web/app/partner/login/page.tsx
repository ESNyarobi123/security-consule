'use client';

import { partnerLogin } from '@pssms/api-client';
import { setPartnerSession } from '@pssms/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function PartnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('partner@demo-security.co.tz');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
          Portal 35.14
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Partner sign in
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Other security company — submit guard supply requests
        </p>

        <label className="mt-6 block text-sm text-slate-600">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
            required
          />
        </label>

        <label className="mt-4 block text-sm text-slate-600">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
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
          className="mt-6 w-full rounded-md bg-sky-700 px-4 py-2.5 font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Continue'}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          Looking for a job?{' '}
          <Link href="/" className="text-sky-700 hover:underline">
            Open careers
          </Link>
        </p>
      </form>
    </div>
  );
}
