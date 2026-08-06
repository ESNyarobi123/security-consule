'use client';

import { partnerLogin } from '@pssms/api-client';
import { setPartnerSession } from '@pssms/auth';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import {
  CareersShell,
  Field,
  inputClass,
} from '../../_components/careers-ui';

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
    <CareersShell active="partner">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-800">
            <Building2 className="h-3.5 w-3.5" />
            Portal 35.14
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#1b1a19] sm:text-4xl">
            Other security company
            <span className="block text-[#4f46e5]">Partner access</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#605e5c]">
            Submit guard supply requests to HIGHLINK. You only see your own
            partner organisation and requests.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-[#323130]">
            <li>• B2B recruitment requests by criteria</li>
            <li>• Track status after HR triage</li>
            <li>• Separate from public job applications</li>
          </ul>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-[#e1dfdd] bg-white p-8 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4f46e5]">
            Partner sign in
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#1b1a19]">Welcome</h2>
          <p className="mt-1 text-sm text-[#605e5c]">
            Use credentials issued by HIGHLINK recruitment.
          </p>

          <div className="mt-6 space-y-4">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
              />
            </Field>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-3 font-semibold text-white shadow hover:brightness-105 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Continue'}
          </button>

          <p className="mt-4 text-center text-xs text-[#605e5c]">
            Looking for a job?{' '}
            <Link href="/" className="font-semibold text-[#4f46e5] hover:underline">
              Open careers
            </Link>
          </p>
        </form>
      </div>
    </CareersShell>
  );
}
