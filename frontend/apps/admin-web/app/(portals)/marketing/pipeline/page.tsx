'use client';

import {
  accrueMarketingCommission,
  cancelMarketingSurvey,
  completeMarketingSurvey,
  convertMarketingContract,
  convertMarketingCustomer,
  createMarketingCommission,
  createMarketingLead,
  createMarketingQuote,
  createMarketingSurvey,
  getMarketingLead,
  getMarketingOptions,
  listMarketingCampaigns,
  listMarketingLeads,
  loseMarketingLead,
  patchMarketingLead,
  patchMarketingQuote,
  payMarketingCommission,
  voidMarketingCommission,
  winMarketingLead,
  type MarketingCampaign,
  type MarketingLead,
  type MarketingLeadDetail,
} from '@pssms/api-client';
import {
  DataTable,
  Modal,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

function errText(e: unknown) {
  if (!(e instanceof Error)) return 'Request failed';
  try {
    const j = JSON.parse(e.message) as {
      message?: string;
      error?: string | { code?: string; message?: string };
    };
    if (typeof j.error === 'object' && j.error) {
      return j.error.message ?? j.error.code ?? e.message;
    }
    return j.message ?? (j.error as string | undefined) ?? e.message;
  } catch {
    return e.message;
  }
}

const fmt = (n: number | null | undefined, currency = 'TZS') =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-TZ', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(n);

type Options = {
  stages: string[];
  sources: string[];
  referrerTypes: string[];
  contractServices: string[];
};

const EMPTY_OPTIONS: Options = {
  stages: [],
  sources: [],
  referrerTypes: [],
  contractServices: [],
};

export default function MarketingPipelinePage() {
  const [rows, setRows] = useState<MarketingLead[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [options, setOptions] = useState<Options>(EMPTY_OPTIONS);
  const [stageFilter, setStageFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [create, setCreate] = useState({
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    source: 'WALK_IN',
    campaignId: '',
    referrerName: '',
    referrerType: 'PARTNER',
    estimatedValue: '',
    notes: '',
  });

  const [detail, setDetail] = useState<MarketingLeadDetail | null>(null);
  const [edit, setEdit] = useState({
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    estimatedValue: '',
    referrerName: '',
    referrerType: '',
    campaignId: '',
    notes: '',
  });

  const [survey, setSurvey] = useState({
    siteAddress: '',
    scheduledAt: '',
    officerName: '',
    notes: '',
  });
  const [quote, setQuote] = useState({
    kind: 'QUOTATION',
    amount: '',
    validUntil: '',
    serviceTypes: ['SECURITY_GUARD'] as string[],
    notes: '',
  });
  const [commission, setCommission] = useState({
    beneficiary: '',
    referrerType: 'PARTNER',
    amount: '',
    notes: '',
  });
  const [win, setWin] = useState({ beneficiary: '', amount: '' });
  const [loseReason, setLoseReason] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contract, setContract] = useState({
    startDate: '2026-11-01',
    endDate: '2027-10-31',
    monthlyFee: '2500000',
    serviceTypes: ['SECURITY_GUARD'] as string[],
    title: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leads, camps, opts] = await Promise.all([
        listMarketingLeads(
          stageFilter || sourceFilter
            ? {
                stage: stageFilter || undefined,
                source: sourceFilter || undefined,
              }
            : undefined,
        ),
        listMarketingCampaigns(),
        getMarketingOptions(),
      ]);
      setRows(leads);
      setCampaigns(camps.filter((c) => c.isActive));
      setOptions({
        stages: opts.stages,
        sources: opts.sources,
        referrerTypes: opts.referrerTypes,
        contractServices: opts.contractServices,
      });
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [stageFilter, sourceFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.companyName.toLowerCase().includes(q) ||
        r.contactName.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openValue = rows
    .filter((r) => r.stage !== 'WON' && r.stage !== 'LOST')
    .reduce((s, r) => s + (r.estimatedValue ?? 0), 0);
  const wonValue = rows
    .filter((r) => r.stage === 'WON')
    .reduce((s, r) => s + (r.estimatedValue ?? 0), 0);
  const wonCount = rows.filter((r) => r.stage === 'WON').length;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id: string) {
    await run(async () => {
      const d = await getMarketingLead(id);
      setDetail(d);
      setEdit({
        companyName: d.companyName,
        contactName: d.contactName,
        contactEmail: d.contactEmail ?? '',
        contactPhone: d.contactPhone ?? '',
        estimatedValue: d.estimatedValue != null ? String(d.estimatedValue) : '',
        referrerName: d.referrerName ?? '',
        referrerType: d.referrerType ?? '',
        campaignId: d.campaignId ?? '',
        notes: d.notes ?? '',
      });
      setWin({
        beneficiary: d.referrerName ?? '',
        amount: '',
      });
      setCustomerName(d.companyName);
      setLoseReason('');
    });
  }

  async function refreshDetail() {
    if (!detail) return;
    await openDetail(detail.id);
    await load();
  }

  async function onCreate() {
    await run(async () => {
      const created = await createMarketingLead({
        companyName: create.companyName,
        contactName: create.contactName,
        contactEmail: create.contactEmail || undefined,
        contactPhone: create.contactPhone || undefined,
        source: create.source || undefined,
        campaignId: create.campaignId || undefined,
        referrerName: create.referrerName || undefined,
        referrerType: create.referrerName
          ? create.referrerType || undefined
          : undefined,
        estimatedValue: create.estimatedValue
          ? Number(create.estimatedValue)
          : undefined,
        notes: create.notes || undefined,
      });
      setCreateOpen(false);
      setCreate({
        companyName: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        source: 'WALK_IN',
        campaignId: '',
        referrerName: '',
        referrerType: 'PARTNER',
        estimatedValue: '',
        notes: '',
      });
      await load();
      await openDetail(created.id);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={inputCls + ' mt-0 w-52'}
            placeholder="Search company / code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={inputCls + ' mt-0 w-auto'}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="">All stages</option>
            {options.stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className={inputCls + ' mt-0 w-auto'}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">All sources</option>
            {options.sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="button" className={btnSecondary} onClick={() => void load()}>
            Refresh
          </button>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setCreateOpen(true)}>
          New lead
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visible leads" value={rows.length} hint="Filtered roster" accent="blue" />
        <StatCard label="Open value" value={fmt(openValue)} hint="Lead → proposal" accent="amber" />
        <StatCard label="Won value" value={fmt(wonValue)} hint={`${wonCount} won leads`} accent="emerald" />
        <StatCard
          label="Conversion"
          value={rows.length ? `${Math.round((wonCount / rows.length) * 100)}%` : '0%'}
          hint="Won ÷ visible leads"
          accent="violet"
        />
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        keyField="id"
        emptyMessage="No leads yet — create the first prospect."
        columns={[
          { key: 'code', label: 'Code' },
          {
            key: 'companyName',
            label: 'Company',
            render: (r) => (
              <div>
                <p className="font-medium text-[#1b1a19]">{r.companyName}</p>
                <p className="text-xs text-[#605e5c]">{r.contactName}</p>
              </div>
            ),
          },
          {
            key: 'stage',
            label: 'Stage',
            render: (r) => <StatusBadge status={r.stage} />,
          },
          { key: 'source', label: 'Source' },
          {
            key: 'estimatedValue',
            label: 'Value',
            render: (r) => fmt(r.estimatedValue, r.currency),
          },
          {
            key: 'campaignCode',
            label: 'Campaign',
            render: (r) => r.campaignCode ?? '—',
          },
          {
            key: 'customerCode',
            label: 'Converted',
            render: (r) =>
              [r.customerCode, r.contractNumber].filter(Boolean).join(' · ') || '—',
          },
          {
            key: 'id',
            label: '',
            render: (r) => (
              <button
                type="button"
                className="text-[#0078d4]"
                onClick={() => void openDetail(r.id)}
              >
                Open
              </button>
            ),
          },
        ]}
      />

      {createOpen ? (
        <Modal title="New lead" onClose={() => setCreateOpen(false)}>
          <div className="space-y-3">
            <label className="block text-sm">
              Company
              <input
                className={inputCls}
                value={create.companyName}
                onChange={(e) =>
                  setCreate((c) => ({ ...c, companyName: e.target.value }))
                }
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                Contact name
                <input
                  className={inputCls}
                  value={create.contactName}
                  onChange={(e) =>
                    setCreate((c) => ({ ...c, contactName: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                Phone
                <input
                  className={inputCls}
                  value={create.contactPhone}
                  onChange={(e) =>
                    setCreate((c) => ({ ...c, contactPhone: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                Email
                <input
                  className={inputCls}
                  type="email"
                  value={create.contactEmail}
                  onChange={(e) =>
                    setCreate((c) => ({ ...c, contactEmail: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                Estimated value (TZS)
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={create.estimatedValue}
                  onChange={(e) =>
                    setCreate((c) => ({ ...c, estimatedValue: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                Source
                <select
                  className={inputCls}
                  value={create.source}
                  onChange={(e) =>
                    setCreate((c) => ({ ...c, source: e.target.value }))
                  }
                >
                  {options.sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Campaign
                <select
                  className={inputCls}
                  value={create.campaignId}
                  onChange={(e) =>
                    setCreate((c) => ({ ...c, campaignId: e.target.value }))
                  }
                >
                  <option value="">None</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Referrer
                <input
                  className={inputCls}
                  value={create.referrerName}
                  onChange={(e) =>
                    setCreate((c) => ({ ...c, referrerName: e.target.value }))
                  }
                  placeholder="Optional referral name"
                />
              </label>
              <label className="block text-sm">
                Referrer type
                <select
                  className={inputCls}
                  value={create.referrerType}
                  onChange={(e) =>
                    setCreate((c) => ({ ...c, referrerType: e.target.value }))
                  }
                  disabled={!create.referrerName}
                >
                  {options.referrerTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              Notes
              <textarea
                className={inputCls}
                rows={2}
                value={create.notes}
                onChange={(e) =>
                  setCreate((c) => ({ ...c, notes: e.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={
                busy ||
                create.companyName.trim().length < 2 ||
                create.contactName.trim().length < 2
              }
              onClick={() => void onCreate()}
            >
              Create lead
            </button>
          </div>
        </Modal>
      ) : null}

      {detail ? (
        <Modal
          title={`${detail.code} · ${detail.companyName}`}
          description={`${detail.contactName} · ${detail.stage} · ${fmt(
            detail.estimatedValue,
            detail.currency,
          )}`}
          onClose={() => setDetail(null)}
          size="lg"
        >
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              {detail.allowedNextStages
                .filter((s) => s !== 'WON' && s !== 'LOST')
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await patchMarketingLead(detail.id, { stage: s });
                        await refreshDetail();
                      })
                    }
                  >
                    → {s}
                  </button>
                ))}
            </div>

            <p className="text-xs text-[#605e5c]">
              Customer {detail.customerCode ?? '—'} · Contract{' '}
              {detail.contractNumber ?? '—'} · Owner {detail.ownerName ?? '—'}
            </p>

            <details className="rounded-md border border-[#e1dfdd] p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Lead details
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block text-xs">
                  Company
                  <input
                    className={inputCls}
                    value={edit.companyName}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, companyName: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  Contact name
                  <input
                    className={inputCls}
                    value={edit.contactName}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, contactName: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  Email
                  <input
                    className={inputCls}
                    value={edit.contactEmail}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, contactEmail: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  Phone
                  <input
                    className={inputCls}
                    value={edit.contactPhone}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, contactPhone: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  Estimated value (TZS)
                  <input
                    className={inputCls}
                    type="number"
                    value={edit.estimatedValue}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, estimatedValue: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  Campaign
                  <select
                    className={inputCls}
                    value={edit.campaignId}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, campaignId: e.target.value }))
                    }
                  >
                    <option value="">None</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs">
                  Referrer
                  <input
                    className={inputCls}
                    value={edit.referrerName}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, referrerName: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  Referrer type
                  <select
                    className={inputCls}
                    value={edit.referrerType}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, referrerType: e.target.value }))
                    }
                  >
                    <option value="">None</option>
                    {options.referrerTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-3 block text-xs">
                Notes
                <textarea
                  className={inputCls}
                  rows={2}
                  value={edit.notes}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, notes: e.target.value }))
                  }
                />
              </label>
              <button
                type="button"
                className={btnSecondary + ' mt-2'}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await patchMarketingLead(detail.id, {
                      companyName: edit.companyName,
                      contactName: edit.contactName,
                      contactEmail: edit.contactEmail || null,
                      contactPhone: edit.contactPhone || null,
                      estimatedValue: edit.estimatedValue
                        ? Number(edit.estimatedValue)
                        : null,
                      campaignId: edit.campaignId || null,
                      referrerName: edit.referrerName || null,
                      referrerType: edit.referrerType || null,
                      notes: edit.notes || null,
                    });
                    await refreshDetail();
                  })
                }
              >
                Save lead details
              </button>
            </details>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-md border border-[#e1dfdd] p-3">
                <p className="font-semibold">Site survey</p>
                {detail.surveys.length === 0 ? (
                  <p className="text-xs text-[#605e5c]">No surveys yet.</p>
                ) : null}
                {detail.surveys.map((s) => (
                  <div key={s.id} className="rounded border border-[#f3f2f1] p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.siteAddress}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="text-[#605e5c]">
                      {new Date(s.scheduledAt).toLocaleString('en-GB')}
                      {s.officerName ? ` · ${s.officerName}` : ''}
                    </p>
                    {s.outcome ? <p>Outcome: {s.outcome}</p> : null}
                    {s.notes ? <p className="text-[#605e5c]">{s.notes}</p> : null}
                    {s.status === 'SCHEDULED' ? (
                      <div className="mt-1 flex gap-3">
                        <button
                          type="button"
                          className="text-[#0078d4]"
                          disabled={busy}
                          onClick={() => {
                            const outcome = window.prompt('Survey outcome');
                            if (!outcome) return;
                            const notes = window.prompt('Survey notes (optional)');
                            void run(async () => {
                              await completeMarketingSurvey(
                                detail.id,
                                s.id,
                                outcome,
                                notes || undefined,
                              );
                              await refreshDetail();
                            });
                          }}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className="text-red-700"
                          disabled={busy}
                          onClick={() => {
                            const reason = window.prompt('Cancel reason (optional)');
                            void run(async () => {
                              await cancelMarketingSurvey(
                                detail.id,
                                s.id,
                                reason || undefined,
                              );
                              await refreshDetail();
                            });
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                <input
                  className={inputCls}
                  placeholder="Site address"
                  value={survey.siteAddress}
                  onChange={(e) =>
                    setSurvey((s) => ({ ...s, siteAddress: e.target.value }))
                  }
                />
                <input
                  className={inputCls}
                  type="datetime-local"
                  value={survey.scheduledAt}
                  onChange={(e) =>
                    setSurvey((s) => ({ ...s, scheduledAt: e.target.value }))
                  }
                />
                <input
                  className={inputCls}
                  placeholder="Officer name"
                  value={survey.officerName}
                  onChange={(e) =>
                    setSurvey((s) => ({ ...s, officerName: e.target.value }))
                  }
                />
                <input
                  className={inputCls}
                  placeholder="Notes"
                  value={survey.notes}
                  onChange={(e) =>
                    setSurvey((s) => ({ ...s, notes: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy || !survey.siteAddress || !survey.scheduledAt}
                  onClick={() =>
                    void run(async () => {
                      await createMarketingSurvey(detail.id, {
                        siteAddress: survey.siteAddress,
                        scheduledAt: new Date(survey.scheduledAt).toISOString(),
                        officerName: survey.officerName || undefined,
                        notes: survey.notes || undefined,
                      });
                      setSurvey({
                        siteAddress: '',
                        scheduledAt: '',
                        officerName: '',
                        notes: '',
                      });
                      await refreshDetail();
                    })
                  }
                >
                  Schedule survey
                </button>
              </div>

              <div className="space-y-2 rounded-md border border-[#e1dfdd] p-3">
                <p className="font-semibold">Quotation / proposal</p>
                {detail.quotes.length === 0 ? (
                  <p className="text-xs text-[#605e5c]">No quotes yet.</p>
                ) : null}
                {detail.quotes.map((q) => (
                  <div key={q.id} className="rounded border border-[#f3f2f1] p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {q.quoteNumber} · {q.kind}
                      </span>
                      <StatusBadge status={q.status} />
                    </div>
                    <p>
                      {fmt(q.amount, q.currency)}
                      {q.validUntil ? ` · valid to ${q.validUntil}` : ''}
                    </p>
                    {q.serviceTypes?.length ? (
                      <p className="text-[#605e5c]">{q.serviceTypes.join(', ')}</p>
                    ) : null}
                    {q.notes ? <p className="text-[#605e5c]">{q.notes}</p> : null}
                    <div className="mt-1 flex flex-wrap gap-2">
                      {q.allowedNextStatuses.map((st) => (
                        <button
                          key={st}
                          type="button"
                          className="text-[#0078d4]"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await patchMarketingQuote(detail.id, q.id, st);
                              await refreshDetail();
                            })
                          }
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    className={inputCls}
                    value={quote.kind}
                    onChange={(e) =>
                      setQuote((s) => ({ ...s, kind: e.target.value }))
                    }
                  >
                    <option value="QUOTATION">QUOTATION</option>
                    <option value="PROPOSAL">PROPOSAL</option>
                  </select>
                  <input
                    className={inputCls}
                    type="number"
                    placeholder="Amount"
                    value={quote.amount}
                    onChange={(e) =>
                      setQuote((s) => ({ ...s, amount: e.target.value }))
                    }
                  />
                  <input
                    className={inputCls}
                    type="date"
                    value={quote.validUntil}
                    onChange={(e) =>
                      setQuote((s) => ({ ...s, validUntil: e.target.value }))
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder="Notes"
                    value={quote.notes}
                    onChange={(e) =>
                      setQuote((s) => ({ ...s, notes: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {options.contractServices.map((svc) => {
                    const on = quote.serviceTypes.includes(svc);
                    return (
                      <button
                        key={svc}
                        type="button"
                        className={
                          on
                            ? 'rounded-full bg-[#deecf9] px-2 py-0.5 text-[11px] text-[#0067b8]'
                            : 'rounded-full border border-[#e1dfdd] px-2 py-0.5 text-[11px] text-[#605e5c]'
                        }
                        onClick={() =>
                          setQuote((s) => ({
                            ...s,
                            serviceTypes: on
                              ? s.serviceTypes.filter((x) => x !== svc)
                              : [...s.serviceTypes, svc],
                          }))
                        }
                      >
                        {svc}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy || !Number(quote.amount)}
                  onClick={() =>
                    void run(async () => {
                      await createMarketingQuote(detail.id, {
                        kind: quote.kind,
                        amount: Number(quote.amount),
                        validUntil: quote.validUntil || undefined,
                        serviceTypes: quote.serviceTypes.length
                          ? quote.serviceTypes
                          : undefined,
                        notes: quote.notes || undefined,
                      });
                      setQuote((s) => ({ ...s, amount: '', notes: '' }));
                      await refreshDetail();
                    })
                  }
                >
                  Add quote
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-[#e1dfdd] p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Referral commission</p>
                <span className="text-xs text-[#605e5c]">
                  Accrue with a second officer; pay on Finance
                </span>
              </div>
              {detail.commissions.length === 0 ? (
                <p className="text-xs text-[#605e5c]">No commission on this lead.</p>
              ) : null}
              {detail.commissions.map((c) => (
                <div key={c.id} className="rounded border border-[#f3f2f1] p-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {c.beneficiary} · {fmt(c.amount, c.currency)}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.notes ? <p className="text-[#605e5c]">{c.notes}</p> : null}
                  <div className="mt-1 flex flex-wrap gap-3">
                    {c.status === 'PENDING' && c.canAccrue ? (
                      <button
                        type="button"
                        className="text-[#0078d4]"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await accrueMarketingCommission(c.id);
                            await refreshDetail();
                          })
                        }
                      >
                        Accrue
                      </button>
                    ) : null}
                    {c.canPay ? (
                      <button
                        type="button"
                        className="text-[#0078d4]"
                        disabled={busy}
                        onClick={() => {
                          const ref = window.prompt('Payment reference');
                          void run(async () => {
                            await payMarketingCommission(c.id, {
                              paymentReference: ref || undefined,
                            });
                            await refreshDetail();
                          });
                        }}
                      >
                        Mark paid
                      </button>
                    ) : null}
                    {c.canVoid ? (
                      <button
                        type="button"
                        className="text-red-700"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt('Void reason');
                          if (!reason) return;
                          void run(async () => {
                            await voidMarketingCommission(c.id, reason);
                            await refreshDetail();
                          });
                        }}
                      >
                        Void
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className={inputCls}
                  placeholder="Beneficiary"
                  value={commission.beneficiary}
                  onChange={(e) =>
                    setCommission((s) => ({
                      ...s,
                      beneficiary: e.target.value,
                    }))
                  }
                />
                <input
                  className={inputCls}
                  type="number"
                  placeholder="Amount"
                  value={commission.amount}
                  onChange={(e) =>
                    setCommission((s) => ({ ...s, amount: e.target.value }))
                  }
                />
                <select
                  className={inputCls}
                  value={commission.referrerType}
                  onChange={(e) =>
                    setCommission((s) => ({
                      ...s,
                      referrerType: e.target.value,
                    }))
                  }
                >
                  {options.referrerTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  className={inputCls}
                  placeholder="Notes"
                  value={commission.notes}
                  onChange={(e) =>
                    setCommission((s) => ({ ...s, notes: e.target.value }))
                  }
                />
              </div>
              <button
                type="button"
                className={btnSecondary}
                disabled={
                  busy ||
                  commission.beneficiary.trim().length < 2 ||
                  !Number(commission.amount)
                }
                onClick={() =>
                  void run(async () => {
                    await createMarketingCommission(detail.id, {
                      beneficiary: commission.beneficiary,
                      amount: Number(commission.amount),
                      referrerType: commission.referrerType || undefined,
                      notes: commission.notes || undefined,
                    });
                    setCommission({
                      beneficiary: '',
                      referrerType: 'PARTNER',
                      amount: '',
                      notes: '',
                    });
                    await refreshDetail();
                  })
                }
              >
                Add commission
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t border-[#e1dfdd] pt-3">
              {detail.allowedNextStages.includes('WON') ? (
                <>
                  <label className="text-xs">
                    Commission beneficiary
                    <input
                      className={inputCls + ' mt-0 w-44'}
                      value={win.beneficiary}
                      onChange={(e) =>
                        setWin((s) => ({ ...s, beneficiary: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Commission TZS
                    <input
                      className={inputCls + ' mt-0 w-36'}
                      type="number"
                      value={win.amount}
                      onChange={(e) =>
                        setWin((s) => ({ ...s, amount: e.target.value }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={
                      busy ||
                      (Number(win.amount) > 0 &&
                        win.beneficiary.trim().length < 2)
                    }
                    onClick={() =>
                      void run(async () => {
                        await winMarketingLead(detail.id, {
                          commissionAmount: win.amount
                            ? Number(win.amount)
                            : undefined,
                          commissionBeneficiary:
                            win.beneficiary.trim() || undefined,
                        });
                        await refreshDetail();
                      })
                    }
                  >
                    Mark won
                  </button>
                </>
              ) : null}
              {detail.allowedNextStages.includes('LOST') ? (
                <>
                  <label className="text-xs">
                    Lost reason
                    <input
                      className={inputCls + ' mt-0 w-52'}
                      value={loseReason}
                      onChange={(e) => setLoseReason(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy || loseReason.trim().length < 2}
                    onClick={() =>
                      void run(async () => {
                        await loseMarketingLead(detail.id, loseReason);
                        await refreshDetail();
                      })
                    }
                  >
                    Mark lost
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t border-[#e1dfdd] pt-3">
              <label className="text-xs">
                Customer name
                <input
                  className={inputCls + ' mt-0 w-56'}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={btnSecondary}
                disabled={busy || Boolean(detail.customerId)}
                onClick={() =>
                  void run(async () => {
                    await convertMarketingCustomer(
                      detail.id,
                      customerName || undefined,
                    );
                    await refreshDetail();
                  })
                }
              >
                Convert to customer (prospect)
              </button>
            </div>

            <div className="space-y-2 rounded-md border border-[#e1dfdd] p-3">
              <p className="font-semibold">Contract conversion</p>
              <p className="text-xs text-[#605e5c]">
                {detail.stage !== 'WON'
                  ? 'Mark the lead won before converting a contract.'
                  : !detail.customerId
                    ? 'Convert the lead to a customer first.'
                    : detail.contractId
                      ? `Linked to ${detail.contractNumber ?? 'contract'}.`
                      : 'Creates a DRAFT contract — approval (Legal → GM → CEO → CMD) happens on /approvals.'}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  className={inputCls}
                  type="date"
                  value={contract.startDate}
                  onChange={(e) =>
                    setContract((s) => ({ ...s, startDate: e.target.value }))
                  }
                />
                <input
                  className={inputCls}
                  type="date"
                  value={contract.endDate}
                  onChange={(e) =>
                    setContract((s) => ({ ...s, endDate: e.target.value }))
                  }
                />
                <input
                  className={inputCls}
                  type="number"
                  placeholder="Monthly fee"
                  value={contract.monthlyFee}
                  onChange={(e) =>
                    setContract((s) => ({ ...s, monthlyFee: e.target.value }))
                  }
                />
              </div>
              <input
                className={inputCls}
                placeholder="Contract title (optional)"
                value={contract.title}
                onChange={(e) =>
                  setContract((s) => ({ ...s, title: e.target.value }))
                }
              />
              <div className="flex flex-wrap gap-2">
                {options.contractServices.map((svc) => {
                  const on = contract.serviceTypes.includes(svc);
                  return (
                    <button
                      key={svc}
                      type="button"
                      className={
                        on
                          ? 'rounded-full bg-[#deecf9] px-2 py-0.5 text-[11px] text-[#0067b8]'
                          : 'rounded-full border border-[#e1dfdd] px-2 py-0.5 text-[11px] text-[#605e5c]'
                      }
                      onClick={() =>
                        setContract((s) => ({
                          ...s,
                          serviceTypes: on
                            ? s.serviceTypes.filter((x) => x !== svc)
                            : [...s.serviceTypes, svc],
                        }))
                      }
                    >
                      {svc}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className={btnPrimary}
                disabled={
                  busy ||
                  detail.stage !== 'WON' ||
                  !detail.customerId ||
                  Boolean(detail.contractId) ||
                  contract.serviceTypes.length === 0
                }
                onClick={() =>
                  void run(async () => {
                    await convertMarketingContract(detail.id, {
                      startDate: contract.startDate,
                      endDate: contract.endDate,
                      monthlyFee: Number(contract.monthlyFee),
                      serviceTypes: contract.serviceTypes,
                      title: contract.title || undefined,
                    });
                    await refreshDetail();
                  })
                }
              >
                Convert to DRAFT contract
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
