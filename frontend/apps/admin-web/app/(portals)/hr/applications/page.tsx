'use client';

import {
  hireJobApplicant,
  issueJobOffer,
  listStaffJobApplications,
  recordJobOfferResponse,
  updateJobApplicationStatus,
  type ApplicationStatusValue,
  type StaffJobApplication,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { FileSignature, RefreshCw, UserPlus } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { FileCabinet } from '../../administration/_components/FileCabinet';
import { HrShell } from '../_components/HrShell';

const STATUSES: Array<'all' | ApplicationStatusValue> = [
  'all',
  'SUBMITTED',
  'SCREENING',
  'INTERVIEW',
  'OFFERED',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
];

const ACTION_LABEL: Partial<Record<ApplicationStatusValue, string>> = {
  SCREENING: 'Start screening',
  INTERVIEW: 'To interview',
  OFFERED: 'Make offer',
  REJECTED: 'Reject',
  WITHDRAWN: 'Withdraw',
};

const OFFER_STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  DECLINED: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200',
  EXPIRED: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
};

const OFFER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Offer · awaiting applicant',
  ACCEPTED: 'Offer · accepted',
  DECLINED: 'Offer · declined',
  EXPIRED: 'Offer · expired',
};

function formatMoney(amount?: string | null, currency?: string | null) {
  if (!amount) return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return `${currency ?? ''} ${amount}`.trim();
  return `${currency ?? ''} ${n.toLocaleString()}`.trim();
}

function formatDay(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function offerIsOpen(row: StaffJobApplication) {
  const offer = row.offer;
  if (!offer || offer.status !== 'PENDING') return false;
  if (offer.expiresAt && new Date(offer.expiresAt).getTime() < Date.now()) {
    return false;
  }
  return true;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HrApplicationsPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canManage =
    session?.roles?.includes('SUPER_ADMIN') ||
    session?.permissions?.includes('recruitment.manage');
  const canDocs = can(session, 'documents.manage');

  const [rows, setRows] = useState<StaffJobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUSES)[number]>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hireTarget, setHireTarget] = useState<StaffJobApplication | null>(
    null,
  );
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState<
    'GUARD' | 'SUPERVISOR' | 'ADMIN' | 'OTHER'
  >('GUARD');
  const [notice, setNotice] = useState<string | null>(null);

  // Offer issue modal
  const [offerTarget, setOfferTarget] = useState<StaffJobApplication | null>(
    null,
  );
  const [offerForm, setOfferForm] = useState({
    position: '',
    department: '',
    employmentType: 'GUARD' as 'GUARD' | 'SUPERVISOR' | 'ADMIN' | 'OTHER',
    salaryAmount: '',
    currency: 'TZS',
    startDate: '',
    expiresInDays: '7',
    message: '',
  });

  const refresh = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listStaffJobApplications({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [canManage, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function advance(
    row: StaffJobApplication,
    next: ApplicationStatusValue,
  ) {
    if (next === 'OFFERED') {
      openOfferModal(row);
      return;
    }
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      const note = notes[row.id]?.trim();
      const updated = await updateJobApplicationStatus(row.id, {
        status: next,
        notes: note || undefined,
      });
      if (next === 'INTERVIEW' && updated.interviewNotification?.email) {
        setNotice(
          `Interview notice queued to ${updated.email} for ${updated.applicantName}.`,
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  function openOfferModal(row: StaffJobApplication) {
    const existing = row.offer;
    setOfferTarget(row);
    setError(null);
    setNotice(null);
    setOfferForm({
      position:
        existing?.position ??
        row.postingTitle ??
        'Security Guard',
      department: existing?.department ?? '',
      employmentType:
        existing?.employmentType ??
        (row.applicantTrack === 'OFFICE' ? 'ADMIN' : 'GUARD'),
      salaryAmount: existing?.salaryAmount ?? '',
      currency: existing?.currency ?? 'TZS',
      startDate: existing?.startDate
        ? new Date(existing.startDate).toISOString().slice(0, 10)
        : '',
      expiresInDays: '7',
      message: existing?.message ?? '',
    });
  }

  async function onIssueOffer(e: FormEvent) {
    e.preventDefault();
    if (!offerTarget) return;
    setBusyId(offerTarget.id);
    setError(null);
    setNotice(null);
    try {
      const salary = offerForm.salaryAmount.trim();
      const updated = await issueJobOffer(offerTarget.id, {
        position: offerForm.position.trim(),
        department: offerForm.department.trim() || undefined,
        employmentType: offerForm.employmentType,
        salaryAmount: salary ? Number(salary) : undefined,
        currency: offerForm.currency.trim() || undefined,
        startDate: offerForm.startDate || undefined,
        expiresInDays: Number(offerForm.expiresInDays) || 7,
        message: offerForm.message.trim() || undefined,
      });
      setOfferTarget(null);
      setNotice(
        `Offer issued to ${updated.applicantName} (${
          updated.offer?.position ?? offerForm.position
        }). ${
          updated.offerNotification?.email
            ? 'Offer email queued.'
            : 'No email queued — applicant email missing.'
        } Waiting for them to accept or decline on the careers portal.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function recordDecision(
    row: StaffJobApplication,
    decision: 'ACCEPT' | 'DECLINE',
  ) {
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      await recordJobOfferResponse(row.id, {
        decision,
        reason:
          decision === 'DECLINE'
            ? notes[row.id]?.trim() || 'Declined by phone'
            : undefined,
      });
      setNotice(
        decision === 'ACCEPT'
          ? `${row.applicantName} marked as having accepted the offer — Hire is now enabled.`
          : `${row.applicantName} marked as having declined the offer. Application withdrawn.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onHire(e: FormEvent) {
    e.preventDefault();
    if (!hireTarget) return;
    setBusyId(hireTarget.id);
    setError(null);
    try {
      await hireJobApplicant(hireTarget.id, {
        employeeNumber: employeeNumber.trim() || undefined,
        department: department.trim() || undefined,
        employmentType,
      });
      setHireTarget(null);
      setEmployeeNumber('');
      setDepartment('');
      setEmploymentType('GUARD');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <HrShell
      title="Applications"
      description="Portal 35.13 / Module 14 — HR Officers, Recruitment Officers, and interview panels share this inbox (HR_OFFICER + recruitment.manage). Screen → interview (email notice) → issue offer terms → applicant accepts/declines on the careers portal → hire. No extra INTERVIEW_PANEL role."
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
      {!canManage ? (
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
                {statusFilter === 'all' && s !== 'all' && counts[s]
                  ? ` (${counts[s]})`
                  : ''}
              </button>
            ))}
          </div>

          {notice ? (
            <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {notice}
            </p>
          ) : null}

          {error ? (
            <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-[#605e5c]">Loading applications…</p>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#e1dfdd] bg-[#faf9f8] px-4 py-8 text-center text-sm text-[#605e5c]">
              No applications for this filter. Public careers posts feed this
              inbox.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => {
                const next = (row.allowedNextStatuses ?? []).filter(
                  (s) => s !== 'REJECTED' && s !== 'WITHDRAWN',
                );
                const terminals = (row.allowedNextStatuses ?? []).filter(
                  (s) => s === 'REJECTED' || s === 'WITHDRAWN',
                );
                return (
                  <li
                    key={row.id}
                    className="rounded-lg border border-[#e1dfdd] bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#1b1a19]">
                          {row.applicantName}{' '}
                          <span className="font-mono text-xs font-medium text-[#0078d4]">
                            {row.referenceNumber}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-[#605e5c]">
                          {row.postingTitle ?? row.postingId.slice(0, 8)} ·{' '}
                          {row.applicantTrack ?? 'GENERAL'} · {row.email}
                          {row.phone ? ` · ${row.phone}` : ''}
                        </p>
                        <p className="mt-1 text-[11px] text-[#8a8886]">
                          Applied {formatWhen(row.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          row.status === 'HIRED'
                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                            : row.status === 'REJECTED' ||
                                row.status === 'WITHDRAWN'
                              ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                              : row.status === 'OFFERED'
                                ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                                : 'bg-[#deecf9] text-[#004578] ring-1 ring-[#c7e0f4]'
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>

                    {row.coverLetter ? (
                      <p className="mt-2 line-clamp-2 text-xs text-[#605e5c]">
                        {row.coverLetter}
                      </p>
                    ) : null}
                    {row.notes ? (
                      <p className="mt-1 text-xs text-[#8a6914]">
                        Notes · {row.notes}
                      </p>
                    ) : null}
                    {row.employeeId ? (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        Employee id · {row.employeeId}
                      </p>
                    ) : null}

                    {row.offer ? (
                      <div className="mt-3 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              OFFER_STATUS_TONE[row.offer.status] ??
                              'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {OFFER_STATUS_LABEL[row.offer.status] ??
                              row.offer.status}
                          </span>
                          {row.offer.expiresAt && row.offer.status === 'PENDING' ? (
                            <span className="text-[11px] text-[#605e5c]">
                              Respond by {formatDay(row.offer.expiresAt)}
                            </span>
                          ) : null}
                        </div>
                        <dl className="mt-2 grid gap-x-4 gap-y-1 text-[11px] text-[#605e5c] sm:grid-cols-2">
                          <div>
                            <dt className="inline font-semibold">Position: </dt>
                            <dd className="inline">
                              {row.offer.position ?? '—'}
                              {row.offer.department
                                ? ` · ${row.offer.department}`
                                : ''}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline font-semibold">Gross pay: </dt>
                            <dd className="inline">
                              {formatMoney(
                                row.offer.salaryAmount,
                                row.offer.currency,
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline font-semibold">Start date: </dt>
                            <dd className="inline">
                              {formatDay(row.offer.startDate)}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline font-semibold">Issued: </dt>
                            <dd className="inline">
                              {formatDay(row.offer.issuedAt)}
                            </dd>
                          </div>
                        </dl>
                        {row.offer.responseReason ? (
                          <p className="mt-1 text-[11px] text-[#8a6914]">
                            Applicant note · {row.offer.responseReason}
                          </p>
                        ) : null}
                        {row.status !== 'HIRED' ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => openOfferModal(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-[#0078d4] bg-white px-2 py-1 text-[11px] font-semibold text-[#0078d4] hover:bg-[#deecf9] disabled:opacity-50"
                            >
                              <FileSignature className="h-3 w-3" />
                              {row.offer.status === 'PENDING'
                                ? 'Re-issue offer'
                                : 'Issue new offer'}
                            </button>
                            {offerIsOpen(row) ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busyId === row.id}
                                  onClick={() =>
                                    void recordDecision(row, 'ACCEPT')
                                  }
                                  className="rounded-md bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                                >
                                  Record acceptance
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId === row.id}
                                  onClick={() =>
                                    void recordDecision(row, 'DECLINE')
                                  }
                                  className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                                >
                                  Record decline
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : row.status === 'OFFERED' ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[11px] text-amber-900">
                          No formal offer issued yet — the applicant has nothing
                          to accept.
                        </p>
                        <button
                          type="button"
                          onClick={() => openOfferModal(row)}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-600"
                        >
                          <FileSignature className="h-3 w-3" />
                          Issue offer
                        </button>
                      </div>
                    ) : null}

                    {(row.allowedNextStatuses?.length || row.canHire) &&
                    row.status !== 'HIRED' ? (
                      <div className="mt-3 space-y-2 border-t border-[#f3f2f1] pt-3">
                        {(terminals.length > 0 ||
                          row.status === 'OFFERED') && (
                          <label className="block">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8a8886]">
                              Notes (required for reject/withdraw)
                            </span>
                            <input
                              value={notes[row.id] ?? ''}
                              onChange={(e) =>
                                setNotes((prev) => ({
                                  ...prev,
                                  [row.id]: e.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-[#e1dfdd] px-2.5 py-1.5 text-sm outline-none focus:border-[#0078d4]"
                              placeholder="HR notes…"
                            />
                          </label>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {next.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void advance(row, s)}
                              className="rounded-md bg-[#0078d4] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#106ebe] disabled:opacity-50"
                            >
                              {ACTION_LABEL[s] ?? s}
                            </button>
                          ))}
                          {row.canHire ? (
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => {
                                setHireTarget(row);
                                setDepartment(row.offer?.department ?? '');
                                setEmployeeNumber('');
                                setEmploymentType(
                                  row.offer?.employmentType ??
                                    (row.applicantTrack === 'OFFICE'
                                      ? 'ADMIN'
                                      : row.applicantTrack === 'GUARD'
                                        ? 'GUARD'
                                        : 'OTHER'),
                                );
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Hire
                            </button>
                          ) : row.status === 'OFFERED' ? (
                            <span className="inline-flex items-center rounded-md bg-[#f3f2f1] px-2.5 py-1 text-[11px] font-medium text-[#605e5c]">
                              {row.offer?.status === 'DECLINED'
                                ? 'Applicant declined — re-issue an offer to continue'
                                : row.offer?.status === 'EXPIRED'
                                  ? 'Offer expired — re-issue to continue'
                                  : row.offer
                                    ? 'Waiting for applicant to accept'
                                    : 'Issue the offer first'}
                            </span>
                          ) : null}
                          {terminals.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void advance(row, s)}
                              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                            >
                              {ACTION_LABEL[s] ?? s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold text-[#1b1a19]">
              Applicant documents
            </h2>
            <p className="mb-3 text-[11px] text-[#605e5c]">
              Public apply stores an optional CV on the application. Additional
              scans (certificates, ID) attach here via MinIO — requires
              documents.manage + recruitment.manage. Public MinIO at apply time
              stays deferred.
            </p>
            <FileCabinet
              resourceType="JobApplication"
              records={rows.map((r) => ({
                id: r.id,
                title: r.applicantName,
                subtitle: `${r.referenceNumber}${r.postingTitle ? ` · ${r.postingTitle}` : ''}`,
              }))}
              recordsLoading={loading}
              canUpload={Boolean(canManage && canDocs)}
              emptyHint="No applications in this filter."
            />
          </section>
        </>
      )}

      {hireTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1a19]/40 p-4">
          <form
            onSubmit={(ev) => void onHire(ev)}
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="text-base font-semibold text-[#1b1a19]">
              Hire {hireTarget.applicantName}
            </h2>
            <p className="mt-1 text-xs text-[#605e5c]">
              Creates an Employee record and marks application HIRED. Start date
              and department default from the accepted offer. Guard profile /
              login link stays on Ops Guards.
            </p>
            <label className="mt-4 block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Employee number
              </span>
              <input
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="Leave empty to auto-generate (GRD-00xx)"
                className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Employment type
              </span>
              <select
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(
                    e.target.value as typeof employmentType,
                  )
                }
                className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm"
              >
                <option value="GUARD">GUARD</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="ADMIN">ADMIN</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Department
              </span>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHireTarget(null)}
                className="rounded-md border border-[#8a8886] px-3 py-1.5 text-xs font-medium text-[#323130]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === hireTarget.id}
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Confirm hire
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {offerTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1b1a19]/40 p-4">
          <form
            onSubmit={(ev) => void onIssueOffer(ev)}
            className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="text-base font-semibold text-[#1b1a19]">
              Offer for {offerTarget.applicantName}
            </h2>
            <p className="mt-1 text-xs text-[#605e5c]">
              The applicant sees these terms on the careers portal, then ACCEPTS
              or DECLINES. Hire unlocks only after acceptance.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                  Position *
                </span>
                <input
                  required
                  value={offerForm.position}
                  onChange={(e) =>
                    setOfferForm((f) => ({ ...f, position: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                  Department
                </span>
                <input
                  value={offerForm.department}
                  onChange={(e) =>
                    setOfferForm((f) => ({ ...f, department: e.target.value }))
                  }
                  placeholder="Operations"
                  className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                  Employment type
                </span>
                <select
                  value={offerForm.employmentType}
                  onChange={(e) =>
                    setOfferForm((f) => ({
                      ...f,
                      employmentType: e.target.value as typeof f.employmentType,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm"
                >
                  <option value="GUARD">GUARD</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                  Monthly gross
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={offerForm.salaryAmount}
                  onChange={(e) =>
                    setOfferForm((f) => ({
                      ...f,
                      salaryAmount: e.target.value,
                    }))
                  }
                  placeholder="650000"
                  className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                  Currency
                </span>
                <select
                  value={offerForm.currency}
                  onChange={(e) =>
                    setOfferForm((f) => ({ ...f, currency: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm"
                >
                  <option value="TZS">TZS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="KES">KES</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                  Proposed start date
                </span>
                <input
                  type="date"
                  value={offerForm.startDate}
                  onChange={(e) =>
                    setOfferForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                  Respond within (days)
                </span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={offerForm.expiresInDays}
                  onChange={(e) =>
                    setOfferForm((f) => ({
                      ...f,
                      expiresInDays: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                  Message to applicant
                </span>
                <textarea
                  rows={3}
                  value={offerForm.message}
                  onChange={(e) =>
                    setOfferForm((f) => ({ ...f, message: e.target.value }))
                  }
                  placeholder="Welcome note, reporting instructions, allowances…"
                  className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOfferTarget(null)}
                className="rounded-md border border-[#8a8886] px-3 py-1.5 text-xs font-medium text-[#323130]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === offerTarget.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0078d4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#106ebe] disabled:opacity-50"
              >
                <FileSignature className="h-3.5 w-3.5" />
                Issue offer
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </HrShell>
  );
}
