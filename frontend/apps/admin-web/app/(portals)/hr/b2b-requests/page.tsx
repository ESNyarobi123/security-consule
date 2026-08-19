'use client';

import {
  billGuardSupplyRequest,
  listB2bCustomerOptions,
  listStaffB2bPartners,
  listStaffGuardSupplyRequests,
  updateB2bPartnerCustomer,
  updateB2bPartnerStatus,
  updateGuardSupplyRequestCharges,
  updateGuardSupplyRequestStatus,
  type B2bCustomerOption,
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

function formatMoney(amount: number | null | undefined, currency?: string | null) {
  if (amount == null) return '—';
  return `${currency ?? 'TZS'} ${amount.toLocaleString()}`;
}

export default function HrB2bRequestsPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canTriage =
    session?.roles?.includes('SUPER_ADMIN') ||
    session?.permissions?.includes('recruitment.manage');

  const [rows, setRows] = useState<GuardSupplyRequest[]>([]);
  const [partners, setPartners] = useState<B2bPartnerProfile[]>([]);
  const [customerOptions, setCustomerOptions] = useState<B2bCustomerOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUSES)[number]>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [charges, setCharges] = useState<
    Record<string, { unitRate: string; discount: string; currency: string }>
  >({});
  const [partnerCustomerPick, setPartnerCustomerPick] = useState<
    Record<string, string>
  >({});

  const partnerById = useMemo(
    () => new Map(partners.map((p) => [p.id, p])),
    [partners],
  );

  const refresh = useCallback(async () => {
    if (!canTriage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, partnerList, customers] = await Promise.all([
        listStaffGuardSupplyRequests(
          statusFilter === 'all' ? undefined : statusFilter,
        ),
        listStaffB2bPartners(),
        listB2bCustomerOptions(),
      ]);
      setRows(list);
      setPartners(partnerList);
      setCustomerOptions(customers);
      setCharges((prev) => {
        const next = { ...prev };
        for (const r of list) {
          if (!next[r.id]) {
            next[r.id] = {
              unitRate:
                r.unitRatePerGuard != null ? String(r.unitRatePerGuard) : '',
              discount:
                r.discountAmount != null ? String(r.discountAmount) : '0',
              currency: r.currency ?? 'TZS',
            };
          }
        }
        return next;
      });
      setPartnerCustomerPick((prev) => {
        const next = { ...prev };
        for (const p of partnerList) {
          if (p.customerId && !next[p.id]) next[p.id] = p.customerId;
        }
        return next;
      });
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

  async function linkPartnerCustomer(partnerId: string) {
    const customerId = partnerCustomerPick[partnerId];
    if (!customerId) return;
    setBusyId(partnerId);
    setError(null);
    try {
      await updateB2bPartnerCustomer(partnerId, customerId);
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

  async function saveCharges(id: string, guardCount: number) {
    const c = charges[id];
    if (!c) return;
    const unitRate = Number(c.unitRate);
    if (!Number.isFinite(unitRate) || unitRate <= 0) {
      setError('Unit rate per guard must be greater than zero');
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await updateGuardSupplyRequestCharges(id, {
        unitRatePerGuard: unitRate,
        discountAmount: Number(c.discount) || 0,
        currency: c.currency.trim() || 'TZS',
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function billRequest(id: string, send: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await billGuardSupplyRequest(id, { send });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  const approvedPartners = partners.filter((p) => p.status === 'APPROVED');

  return (
    <HrShell
      title="B2B guard supply"
      description="Portal 35.14 — other registered security companies. Approve partners, then triage guard-supply requests (count, qualifications, location, training, urgency, terms). Link CRM + bill accepted supply (§15-B). Creator ≠ processor."
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

          {approvedPartners.length > 0 ? (
            <section className="mb-6 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                Partner billing (CRM link)
              </p>
              <p className="mt-1 text-xs text-[#605e5c]">
                Link each approved partner to a CRM customer before invoicing
                accepted requests.
              </p>
              <ul className="mt-3 space-y-2">
                {approvedPartners.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-end gap-2 rounded-md bg-white px-3 py-2 ring-1 ring-[#edebe9]"
                  >
                    <div className="min-w-[140px] flex-1">
                      <p className="text-sm font-medium text-[#1b1a19]">
                        {p.name}{' '}
                        <span className="font-mono text-xs text-[#605e5c]">
                          {p.code}
                        </span>
                      </p>
                      {p.customerCode ? (
                        <p className="text-xs text-[#107c10]">
                          Linked: {p.customerCode} · {p.customerName}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700">No CRM customer</p>
                      )}
                    </div>
                    <select
                      value={partnerCustomerPick[p.id] ?? p.customerId ?? ''}
                      onChange={(e) =>
                        setPartnerCustomerPick((m) => ({
                          ...m,
                          [p.id]: e.target.value,
                        }))
                      }
                      className="rounded-md border border-[#8a8886] px-2 py-1.5 text-xs"
                    >
                      <option value="">Select customer…</option>
                      {customerOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={
                        busyId === p.id ||
                        !(partnerCustomerPick[p.id] ?? p.customerId)
                      }
                      onClick={() => void linkPartnerCustomer(p.id)}
                      className="rounded-md bg-[#0078d4] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Save link
                    </button>
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
              {rows.map((r) => {
                const partner = partnerById.get(r.partnerId);
                const charge = charges[r.id] ?? {
                  unitRate: '',
                  discount: '0',
                  currency: 'TZS',
                };
                const unitNum = Number(charge.unitRate);
                const discountNum = Number(charge.discount) || 0;
                const previewNet =
                  Number.isFinite(unitNum) && unitNum > 0
                    ? Math.max(0, unitNum * r.guardCount - discountNum)
                    : null;

                return (
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
                        {partner && !partner.customerId ? (
                          <p className="mt-1 text-xs text-amber-700">
                            Partner has no CRM customer — link above before
                            billing.
                          </p>
                        ) : null}
                        {r.qualifications ? (
                          <p className="mt-1 text-xs text-[#605e5c]">
                            Qualifications: {r.qualifications}
                          </p>
                        ) : null}
                        {(r.experienceYearsMin != null ||
                          r.ageMin != null ||
                          r.ageMax != null ||
                          r.languages ||
                          r.heightMinCm != null ||
                          r.militaryTrainingRequired ||
                          r.firearmTrainingRequired) && (
                          <p className="mt-1 text-xs text-[#605e5c]">
                            Criteria:{' '}
                            {[
                              r.experienceYearsMin != null
                                ? `≥${r.experienceYearsMin}y`
                                : null,
                              r.ageMin != null || r.ageMax != null
                                ? `age ${r.ageMin ?? '—'}-${r.ageMax ?? '—'}`
                                : null,
                              r.heightMinCm != null
                                ? `≥${r.heightMinCm}cm`
                                : null,
                              r.languages,
                              r.genderPreference &&
                              r.genderPreference !== 'ANY'
                                ? r.genderPreference
                                : null,
                              r.militaryTrainingRequired ? 'military' : null,
                              r.firearmTrainingRequired ? 'firearm' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                        {r.healthConditionNotes ? (
                          <p className="mt-1 text-xs text-[#605e5c]">
                            Health: {r.healthConditionNotes}
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

                    {r.invoiceId ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-[#e8f4fd] px-2 py-0.5 font-medium text-[#0078d4]">
                          {r.invoiceNumber ?? r.invoiceId}
                        </span>
                        {r.invoiceStatus ? (
                          <span className="rounded-full bg-[#f3f2f1] px-2 py-0.5 text-[#323130]">
                            {r.invoiceStatus}
                          </span>
                        ) : null}
                        <span className="text-[#605e5c]">
                          Fee {formatMoney(r.serviceFeeAmount, r.currency)}
                        </span>
                        {r.amountPaid != null ? (
                          <span className="text-[#605e5c]">
                            Paid {formatMoney(r.amountPaid, r.currency)}
                          </span>
                        ) : null}
                        {r.balanceDue != null && r.balanceDue > 0 ? (
                          <span className="text-amber-800">
                            Due {formatMoney(r.balanceDue, r.currency)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

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

                    {r.status === 'ACCEPTED' && !r.invoiceId ? (
                      <div className="mt-4 rounded-md border border-[#edebe9] bg-[#faf9f8] p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                          Service charges
                        </p>
                        <p className="mt-1 text-xs text-[#605e5c]">
                          Net = rate × {r.guardCount} guards − discount. Bill
                          creates a DRAFT invoice (Finance).
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <label className="text-xs text-[#605e5c]">
                            Rate / guard
                            <input
                              type="number"
                              min={0}
                              step="1000"
                              value={charge.unitRate}
                              onChange={(e) =>
                                setCharges((m) => ({
                                  ...m,
                                  [r.id]: {
                                    ...charge,
                                    unitRate: e.target.value,
                                  },
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-[#8a8886] px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="text-xs text-[#605e5c]">
                            Discount
                            <input
                              type="number"
                              min={0}
                              step="1000"
                              value={charge.discount}
                              onChange={(e) =>
                                setCharges((m) => ({
                                  ...m,
                                  [r.id]: {
                                    ...charge,
                                    discount: e.target.value,
                                  },
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-[#8a8886] px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="text-xs text-[#605e5c]">
                            Currency
                            <input
                              value={charge.currency}
                              onChange={(e) =>
                                setCharges((m) => ({
                                  ...m,
                                  [r.id]: {
                                    ...charge,
                                    currency: e.target.value.toUpperCase(),
                                  },
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-[#8a8886] px-2 py-1.5 text-sm"
                            />
                          </label>
                        </div>
                        {previewNet != null ? (
                          <p className="mt-2 text-xs text-[#323130]">
                            Preview net:{' '}
                            {formatMoney(previewNet, charge.currency)}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void saveCharges(r.id, r.guardCount)}
                            className="rounded-md border border-[#8a8886] bg-white px-2.5 py-1 text-xs font-medium text-[#323130] disabled:opacity-50"
                          >
                            Save charges
                          </button>
                          <button
                            type="button"
                            disabled={
                              busyId === r.id ||
                              !(r.serviceFeeAmount && r.serviceFeeAmount > 0)
                            }
                            onClick={() => void billRequest(r.id, false)}
                            className="rounded-md bg-[#0078d4] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {busyId === r.id ? '…' : 'Bill draft'}
                          </button>
                          <button
                            type="button"
                            disabled={
                              busyId === r.id ||
                              !(r.serviceFeeAmount && r.serviceFeeAmount > 0)
                            }
                            onClick={() => void billRequest(r.id, true)}
                            className="rounded-md bg-[#107c10] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Send invoice
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </HrShell>
  );
}
