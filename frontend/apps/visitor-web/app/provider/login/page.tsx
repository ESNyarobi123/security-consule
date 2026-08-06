'use client';

import { providerLogin } from '@pssms/api-client';
import { setProviderSession } from '@pssms/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

function canAccessProviderPortal(user: {
  roles: string[];
  permissions: string[];
}): boolean {
  if (user.roles.includes('SERVICE_PROVIDER')) return true;
  if (
    user.permissions.includes('providers.self') &&
    !user.permissions.includes('visitors.manage')
  ) {
    return true;
  }
  return false;
}

export default function ProviderLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('provider1@techcare.tz');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await providerLogin(email, password);
      if (!canAccessProviderPortal(result.user)) {
        setError(
          'This account is not an approved service provider (need SERVICE_PROVIDER / providers.self).',
        );
        return;
      }
      setProviderSession(
        result.tokens.accessToken,
        result.user,
        result.tokens.refreshToken,
      );
      router.push('/provider');
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Portal 35.10
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Service provider sign in
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          View your maintenance visit appointments and gate entry history
        </p>

        <label className="mt-6 block text-sm text-slate-600">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            required
          />
        </label>

        <label className="mt-4 block text-sm text-slate-600">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
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
          className="mt-6 w-full rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Continue'}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          Consultant?{' '}
          <Link href="/consultant/login" className="text-teal-700 hover:underline">
            Consultant sign in
          </Link>
          {' · '}
          <Link href="/" className="text-teal-700 hover:underline">
            Book visit
          </Link>
        </p>
      </form>
    </div>
  );
}
