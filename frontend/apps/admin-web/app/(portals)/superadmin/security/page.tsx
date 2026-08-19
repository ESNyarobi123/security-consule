'use client';

import {
  getPasswordPolicy,
  setPasswordPolicy,
  type PasswordPolicy,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { GlassCard, btnPrimary } from '@pssms/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fieldCls, formatApiError } from '../_components/shared';

const emptyPolicy: PasswordPolicy = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: false,
};

export default function SuperAdminSecurityPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canWrite =
    session?.roles.includes('SUPER_ADMIN') ||
    session?.roles.includes('GENERAL_MANAGER');
  const [policy, setPolicy] = useState<PasswordPolicy>(emptyPolicy);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const p = await getPasswordPolicy();
      setPolicy({ ...emptyPolicy, ...p });
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const next = await setPasswordPolicy(policy);
      setPolicy({ ...emptyPolicy, ...next });
      setSaved('Password policy saved.');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1a19]">Security settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#605e5c]">
          Organization password policy (Module 5-K). MFA enroll/reset lives on
          Users. Org-wide force-MFA and encrypted TOTP-at-rest remain deferred.
        </p>
      </div>
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {saved}
        </p>
      ) : null}

      <GlassCard glow="none" className="max-w-xl p-4">
        <form onSubmit={(e) => void onSave(e)} className="space-y-3">
          <label className="block text-sm">
            Minimum length
            <input
              type="number"
              min={8}
              max={64}
              className={fieldCls + ' mt-1 w-full'}
              value={policy.minLength}
              disabled={!canWrite}
              onChange={(e) =>
                setPolicy((p) => ({ ...p, minLength: Number(e.target.value) }))
              }
            />
          </label>
          {(
            [
              ['requireUppercase', 'Require uppercase'],
              ['requireLowercase', 'Require lowercase'],
              ['requireDigit', 'Require digit'],
              ['requireSymbol', 'Require symbol'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!canWrite}
                checked={Boolean(policy[key])}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
          <button type="submit" className={btnPrimary} disabled={!canWrite || busy}>
            {canWrite ? 'Save policy' : 'GM / Super Admin only'}
          </button>
        </form>
      </GlassCard>

      <p className="text-sm text-[#605e5c]">
        Reset another user’s password or MFA from{' '}
        <Link href="/superadmin/users" className="text-[#0078d4]">
          Users
        </Link>
        . Login history is also on that roster.
      </p>
    </div>
  );
}
