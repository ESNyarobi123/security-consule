'use client';

import { supplierLogin } from '@pssms/api-client';
import { setSupplierSession } from '@pssms/auth';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('portal@uniforms.co.tz');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6fa] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-[#e1dfdd] bg-white p-8 shadow-xl"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-[#0067b8]">
          Supplier Portal
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Profile · Purchase orders</p>

        <label className="mt-6 block text-sm text-slate-600">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#8a8886] bg-white px-3 py-2 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
            required
          />
        </label>

        <label className="mt-4 block text-sm text-slate-600">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#8a8886] bg-white px-3 py-2 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
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
          className="mt-6 w-full rounded-md bg-[#0078d4] px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#106ebe] disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
