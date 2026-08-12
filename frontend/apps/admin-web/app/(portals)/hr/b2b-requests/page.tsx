'use client';

import {
  listStaffB2bPartners,
  listStaffGuardSupplyRequests,
  updateB2bPartnerStatus,
  updateGuardSupplyRequestStatus,
  type B2bPartnerProfile,
  type GuardSupplyRequest,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HrShell } from '../_components/HrShell';

const STATUSES = [
  'all',
  'SUBMITTED',
  'UNDER_REVIEW',
  'ACCEPTED',
  'REJECTED',
] as const;

export default function HrB2bRequestsPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canTriage =
    session?.roles?.includes('SUPER_ADMIN') ||
    session?.permissions?.includes('recruitment.manage');

  const [rows, setRows] = useState<GuardSupplyRequest[]>([]);
  const [partners, setPartners] = useState<B2bPartnerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUSES)[number]>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!canTriage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, partnerList] = await Promise.all([
        listStaffGuardSupplyRequests(
          statusFilter === 'all' ? undefined : statusFilter,
        ),
        listStaffB2bPartners(),
      ]);
      setRows(list);
      setPartners(partnerList);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [canTriage, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setPartnerStatus(id: string, status: string) {
    setBusyId(id);
    setError(null);
    try {
      await updateB2bPartnerStatus(id, status);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    setError(null);
    try {
      await updateGuardSupplyRequestStatus(id, {
        status,
        staffNotes: notes[id]?.trim() || undefined,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <HrShell
      title="B2B guard supply"
      description="Portal 35.14 — triage requests from other security companies (§15 thin)."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#8a8886] bg-white px-3 py-1.5 text-xs font-medium text-[#323130] hover:bg-[#f3f2f1]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      }
    >
      {!canTriage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Requires <code className="text-xs">recruitment.manage</code> (HR
          officer / Super Admin).
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  statusFilter === s
                    ? 'bg-[#0078d4] text-white'
                    : 'bg-[#f3f2f1] text-[#605e5c] hover:bg-[#edebe9]'
                }`}
              >
                {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {error ? (
            <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {partners.filter((p) => p.status === 'PENDING').length > 0 ? (
            <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Pending partner registrations
              </p>
              <ul className="mt-3 space-y-2">
                {partners
                  .filter((p) => p.status === 'PENDING')
                  .map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 ring-1 ring-amber-100"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#1b1a19]">
                          {p.name}{' '}
                          <span className="font-mono text-xs font-normal text-[#605e5c]">
                            {p.code}
                          </span>
                        </p>
                        <p className="text-xs text-[#605e5c]">{p.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => void setPartnerStatus(p.id, 'APPROVED')}
                          className="rounded-md bg-[#107c10] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => void setPartnerStatus(p.id, 'SUSPENDED')}
                          className="rounded-md border border-[#8a8886] bg-white px-2.5 py-1 text-xs font-medium text-[#323130] disabled:opacity-60"
                        >
                          Suspend
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          {loading ? (
            <p className="text-sm text-[#605e5c]">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[#605e5c]">No B2B requests.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-[#e1dfdd] bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#1b1a19]">
                        {r.referenceNumber}{' '}
                        <span className="text-sm font-normal text-[#605e5c]">
                          · {r.partnerName ?? r.partnerCode ?? r.partnerId}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm text-[#605e5c]">
                        {r.guardCount} guards
                        {r.siteLocation ? ` · ${r.siteLocation}` : ''}
                        {r.urgency ? ` · ${r.urgency}` : ''}
                        {r.startDate ? ` · ${r.startDate}` : ''}
                        {r.endDate ? ` → ${r.endDate}` : ''}
                      </p>
                      {r.qualifications ? (
                        <p className="mt-1 text-xs text-[#605e5c]">
                          Qualifications: {r.qualifications}
                        </p>
                      ) : null}
                      {r.trainingNeeds ? (
                        <p className="mt-1 text-xs text-[#605e5c]">
                          Training: {r.trainingNeeds}
                        </p>
                      ) : null}
                      {r.serviceTerms ? (
                        <p className="mt-1 text-xs text-[#605e5c]">
                          Terms: {r.serviceTerms}
                        </p>
                      ) : null}
                      {r.criteriaNotes ? (
                        <p className="mt-1 text-xs text-[#605e5c]">
                          {r.criteriaNotes}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-[#f3f2f1] px-2 py-0.5 text-xs font-medium text-[#323130]">
                      {r.status}
                    </span>
                  </div>

                  <label className="mt-3 block text-xs text-[#605e5c]">
                    Staff notes
                    <input
                      value={notes[r.id] ?? r.staffNotes ?? ''}
                      onChange={(e) =>
                        setNotes((m) => ({ ...m, [r.id]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-[#8a8886] px-2 py-1.5 text-sm text-[#1b1a19]"
                      placeholder="Optional triage note"
                    />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        ['UNDER_REVIEW', 'Under review'],
                        ['ACCEPTED', 'Accept'],
                        ['REJECTED', 'Reject'],
                      ] as const
                    ).map(([status, label]) => (
                      <button
                        key={status}
                        type="button"
                        disabled={busyId === r.id || r.status === status}
                        onClick={() => void setStatus(r.id, status)}
                        className="rounded-md border border-[#8a8886] bg-white px-2.5 py-1 text-xs font-medium text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-50"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </HrShell>
  );
}
