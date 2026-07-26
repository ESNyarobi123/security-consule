'use client';

import { getEssMe, type EssProfile } from '@pssms/api-client';
import { GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import {
  PanelEmpty,
  formatDate,
  isEssProfileMissing,
} from '../_components/shared';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e1dfdd] bg-white px-3 py-2.5">
      <p className="text-[11px] text-[#605e5c]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[#1b1a19]">{value}</p>
    </div>
  );
}

export default function EssProfilePage() {
  const [profile, setProfile] = useState<EssProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      setProfile(await getEssMe());
    } catch (err) {
      if (isEssProfileMissing(err)) {
        setProfile(null);
        setMissing(true);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <EssShell
      title="Profile"
      description="Read-only employee record linked to your account."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {missing ? (
        <PanelEmpty
          icon={<UserX className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login. Contact HR so they can connect your user account to an employee record."
        />
      ) : null}

      {profile ? (
        <GlassCard>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-base font-semibold text-[#1b1a19]">
                {profile.fullName}
              </p>
              <p className="font-mono text-xs text-[#605e5c]">
                {profile.employeeNumber}
              </p>
            </div>
            <StatusBadge status={profile.status} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Department" value={profile.department ?? '—'} />
            <Field label="Employment type" value={profile.employmentType} />
            <Field label="Email" value={profile.email ?? '—'} />
            <Field label="Phone" value={profile.phone ?? '—'} />
            <Field label="Hire date" value={formatDate(profile.hireDate)} />
            <Field
              label="Guard profile"
              value={
                profile.guardProfileId
                  ? profile.guardProfileId.slice(0, 8) + '…'
                  : '—'
              }
            />
          </div>
        </GlassCard>
      ) : null}

      {!missing && !profile && !loading && !error ? (
        <PanelEmpty
          icon={<UserX className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login."
        />
      ) : null}
    </EssShell>
  );
}
