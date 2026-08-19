'use client';

import {
  completeMarketingSurvey,
  convertMarketingContract,
  convertMarketingCustomer,
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
  winMarketingLead,
  type MarketingCampaign,
  type MarketingLead,
  type MarketingLeadDetail,
} from '@pssms/api-client';
import {
  DataTable,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

function errText(e: unknown) {
  if (!(e instanceof Error)) return 'Request failed';
  try {
    const j = JSON.parse(e.message) as { message?: string; error?: string };
    return j.message ?? j.error ?? e.message;
  } catch {
    return e.message;
  }
}

export default function MarketingPipelinePage() {
  const [rows, setRows] = useState<MarketingLead[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<MarketingLeadDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [source, setSource] = useState('WALK_IN');
  const [campaignId, setCampaignId] = useState('');
  const [referrerName, setReferrerName] = useState('');

  const [surveyAddress, setSurveyAddress] = useState('');
  const [surveyWhen, setSurveyWhen] = useState('');
  const [quoteKind, setQuoteKind] = useState('QUOTATION');
  const [quoteAmount, setQuoteAmount] = useState('1000000');
  const [winCommission, setWinCommission] = useState('');
  const [loseReason, setLoseReason] = useState('');
  const [contractStart, setContractStart] = useState('2026-09-01');
  const [contractEnd, setContractEnd] = useState('2027-08-31');
  const [contractFee, setContractFee] = useState('2500000');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leads, camps, opts] = await Promise.all([
        listMarketingLeads(stageFilter ? { stage: stageFilter } : undefined),
        listMarketingCampaigns(),
        getMarketingOptions(),
      ]);
      setRows(leads);
      setCampaigns(camps.filter((c) => c.isActive));
      setStages(opts.stages);
      setSources(opts.sources);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [stageFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshDetail(id: string) {
    setDetail(await getMarketingLead(id));
    await load();
  }

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const created = await createMarketingLead({
        companyName,
        contactName,
        contactPhone: contactPhone || undefined,
        source,
        campaignId: campaignId || undefined,
        referrerName: referrerName || undefined,
        referrerType: referrerName ? 'PARTNER' : undefined,
      });
      setCreateOpen(false);
      setCompanyName('');
      setContactName('');
      setDetail(created);
      await load();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select
            className={inputCls + ' mt-0 w-auto'}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="">All stages</option>
            {stages.map((s) => (
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
      <DataTable
        loading={loading}
        rows={rows}
        keyField="id"
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'companyName', label: 'Company' },
          { key: 'contactName', label: 'Contact' },
          {
            key: 'stage',
            label: 'Stage',
            render: (r) => <StatusBadge status={r.stage} />,
          },
          { key: 'source', label: 'Source' },
          {
            key: 'customerCode',
            label: 'Converted',
            render: (r) =>
              [r.customerCode, r.contractNumber].filter(Boolean).join(' · ') ||
              '—',
          },
          {
            key: 'id',
            label: '',
            render: (r) => (
              <button
                type="button"
                className="text-[#0078d4]"
                onClick={() => void refreshDetail(r.id)}
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
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Contact
              <input
                className={inputCls}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Phone
              <input
                className={inputCls}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Source
              <select
                className={inputCls}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {sources.map((s) => (
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
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
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
              Referrer (optional)
              <input
                className={inputCls}
                value={referrerName}
                onChange={(e) => setReferrerName(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || companyName.length < 2 || contactName.length < 2}
              onClick={() => void onCreate()}
            >
              Create
            </button>
          </div>
        </Modal>
      ) : null}

      {detail ? (
        <Modal
          title={`${detail.code} · ${detail.companyName}`}
          description={`${detail.contactName} · ${detail.stage}`}
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
                      void (async () => {
                        setBusy(true);
                        try {
                          await refreshDetail(
                            (await patchMarketingLead(detail.id, { stage: s })).id,
                          );
                        } catch (e) {
                          setError(errText(e));
                        } finally {
                          setBusy(false);
                        }
                      })()
                    }
                  >
                    {s}
                  </button>
                ))}
            </div>
            <p className="text-xs text-[#605e5c]">
              Customer {detail.customerCode ?? '—'} · Contract{' '}
              {detail.contractNumber ?? '—'}
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-md border border-[#e1dfdd] p-3">
                <p className="font-semibold">Site survey</p>
                {detail.surveys.map((s) => (
                  <div key={s.id} className="text-xs">
                    {s.status} · {s.siteAddress}
                    {s.status === 'SCHEDULED' ? (
                      <button
                        type="button"
                        className="ml-2 text-[#0078d4]"
                        onClick={() =>
                          void (async () => {
                            const outcome = window.prompt('Survey outcome');
                            if (!outcome) return;
                            await completeMarketingSurvey(detail.id, s.id, outcome);
                            await refreshDetail(detail.id);
                          })()
                        }
                      >
                        Complete
                      </button>
                    ) : null}
                  </div>
                ))}
                <input
                  className={inputCls}
                  placeholder="Site address"
                  value={surveyAddress}
                  onChange={(e) => setSurveyAddress(e.target.value)}
                />
                <input
                  className={inputCls}
                  type="datetime-local"
                  value={surveyWhen}
                  onChange={(e) => setSurveyWhen(e.target.value)}
                />
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={!surveyAddress || !surveyWhen || busy}
                  onClick={() =>
                    void (async () => {
                      await createMarketingSurvey(detail.id, {
                        siteAddress: surveyAddress,
                        scheduledAt: new Date(surveyWhen).toISOString(),
                      });
                      setSurveyAddress('');
                      await refreshDetail(detail.id);
                    })()
                  }
                >
                  Schedule survey
                </button>
              </div>

              <div className="space-y-2 rounded-md border border-[#e1dfdd] p-3">
                <p className="font-semibold">Quote / proposal</p>
                {detail.quotes.map((q) => (
                  <div key={q.id} className="text-xs">
                    {q.quoteNumber} · {q.kind} · {q.status} · {q.amount}
                    {q.allowedNextStatuses.map((st) => (
                      <button
                        key={st}
                        type="button"
                        className="ml-2 text-[#0078d4]"
                        onClick={() =>
                          void (async () => {
                            await patchMarketingQuote(detail.id, q.id, st);
                            await refreshDetail(detail.id);
                          })()
                        }
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                ))}
                <select
                  className={inputCls}
                  value={quoteKind}
                  onChange={(e) => setQuoteKind(e.target.value)}
                >
                  <option value="QUOTATION">QUOTATION</option>
                  <option value="PROPOSAL">PROPOSAL</option>
                </select>
                <input
                  className={inputCls}
                  type="number"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(e.target.value)}
                />
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      await createMarketingQuote(detail.id, {
                        kind: quoteKind,
                        amount: Number(quoteAmount),
                        serviceTypes: ['SECURITY_GUARD'],
                      });
                      await refreshDetail(detail.id);
                    })()
                  }
                >
                  Add quote
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {detail.allowedNextStages.includes('WON') ? (
                <>
                  <input
                    className={inputCls + ' mt-0 w-40'}
                    placeholder="Commission TZS"
                    value={winCommission}
                    onChange={(e) => setWinCommission(e.target.value)}
                  />
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        await winMarketingLead(detail.id, {
                          commissionAmount: winCommission
                            ? Number(winCommission)
                            : undefined,
                          commissionBeneficiary: detail.referrerName ?? undefined,
                        });
                        await refreshDetail(detail.id);
                      })()
                    }
                  >
                    Mark won
                  </button>
                </>
              ) : null}
              {detail.allowedNextStages.includes('LOST') ? (
                <>
                  <input
                    className={inputCls + ' mt-0 w-48'}
                    placeholder="Lost reason"
                    value={loseReason}
                    onChange={(e) => setLoseReason(e.target.value)}
                  />
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy || loseReason.length < 2}
                    onClick={() =>
                      void (async () => {
                        await loseMarketingLead(detail.id, loseReason);
                        await refreshDetail(detail.id);
                      })()
                    }
                  >
                    Mark lost
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[#e1dfdd] pt-3">
              <button
                type="button"
                className={btnSecondary}
                disabled={busy || Boolean(detail.customerId)}
                onClick={() =>
                  void (async () => {
                    try {
                      await refreshDetail(
                        (await convertMarketingCustomer(detail.id)).id,
                      );
                    } catch (e) {
                      setError(errText(e));
                    }
                  })()
                }
              >
                Convert to customer (prospect)
              </button>
              <input
                className={inputCls + ' mt-0 w-36'}
                type="date"
                value={contractStart}
                onChange={(e) => setContractStart(e.target.value)}
              />
              <input
                className={inputCls + ' mt-0 w-36'}
                type="date"
                value={contractEnd}
                onChange={(e) => setContractEnd(e.target.value)}
              />
              <input
                className={inputCls + ' mt-0 w-32'}
                type="number"
                value={contractFee}
                onChange={(e) => setContractFee(e.target.value)}
              />
              <button
                type="button"
                className={btnPrimary}
                disabled={busy || !detail.customerId || Boolean(detail.contractId)}
                onClick={() =>
                  void (async () => {
                    try {
                      await refreshDetail(
                        (
                          await convertMarketingContract(detail.id, {
                            startDate: contractStart,
                            endDate: contractEnd,
                            monthlyFee: Number(contractFee),
                            serviceTypes: ['SECURITY_GUARD'],
                          })
                        ).id,
                      );
                    } catch (e) {
                      setError(errText(e));
                    }
                  })()
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
