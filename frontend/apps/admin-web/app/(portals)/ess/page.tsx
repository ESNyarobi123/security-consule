'use client';

import { getEssMe, type EssProfile } from '@pssms/api-client';
import { GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EssShell } from './_components/EssShell';
import {
  PanelEmpty,
  QuickLink,
  formatDate,
  isEssProfileMissing,
} from './_components/shared';

export default function EssOverviewPage() {
  const [profile, setProfile] = useState<EssProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const me = await getEssMe();
      setProfile(me);
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
      title="Overview"
      description="Your profile, leave, requests, payslips, loans, and assigned equipment — self-service only."
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
          {loading ? '…' : 'Refresh'}
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

      {!missing && profile ? (
        <>
          <GlassCard className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                  Profile summary
                </p>
                <p className="mt-1 text-base font-semibold text-[#1b1a19]">
                  {profile.fullName}
                </p>
                <p className="mt-0.5 font-mono text-xs text-[#605e5c]">
                  {profile.employeeNumber}
                  {profile.department ? ` · ${profile.department}` : ''}
                </p>
              </div>
              <StatusBadge status={profile.status} />
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-[11px] text-[#605e5c]">Type</dt>
                <dd className="text-sm text-[#323130]">
                  {profile.employmentType}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#605e5c]">Email</dt>
                <dd className="truncate text-sm text-[#323130]">
                  {profile.email ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#605e5c]">Phone</dt>
                <dd className="text-sm text-[#323130]">
                  {profile.phone ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#605e5c]">Hire date</dt>
                <dd className="text-sm text-[#323130]">
                  {formatDate(profile.hireDate)}
                </dd>
              </div>
            </dl>
          </GlassCard>

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
              Quick links
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <QuickLink
                href="/ess/profile"
                label="Profile"
                hint="View your employee record"
                glyph="user-check"
              />
              <QuickLink
                href="/ess/leave"
                label="Leave"
                hint="Apply and track requests"
                glyph="calendar"
              />
              <QuickLink
                href="/ess/requests"
                label="Requests"
                hint="Leave, loan, movement, petty cash"
                glyph="clipboard"
              />
              <QuickLink
                href="/ess/payslips"
                label="Payslips"
                hint="Read-only pay history"
                glyph="wallet"
              />
              <QuickLink
                href="/ess/loans"
                label="Loans"
                hint="Apply and view status"
                glyph="coins"
              />
              <QuickLink
                href="/ess/petty-cash"
                label="Petty cash"
                hint="Request imprest spend"
                glyph="wallet"
              />
              <QuickLink
                href="/ess/equipment"
                label="Equipment"
                hint="Assets assigned to you"
                glyph="box"
              />
            </div>
          </section>
        </>
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
