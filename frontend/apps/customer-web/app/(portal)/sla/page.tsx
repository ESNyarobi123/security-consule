'use client';

import {
  getCustomerPortalReport,
  listCustomerContracts,
  type CustomerContractView,
  type CustomerPortalReport,
} from '@pssms/api-client';
import { Gauge, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalStat,
  StatusPill,
  formatDate,
  money,
} from '../../_components/portal-ui';

export default function SlaPage() {
  const [rows, setRows] = useState<CustomerContractView[]>([]);
  const [report, setReport] = useState<CustomerPortalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contracts, pack] = await Promise.all([
        listCustomerContracts(),
        getCustomerPortalReport(),
      ]);
      setRows(contracts as CustomerContractView[]);
      setReport(pack);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SLA');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(
    () => rows.filter((r) => r.status.toUpperCase().includes('ACTIVE')),
    [rows],
  );
  const expiring = useMemo(() => {
    const in90 = Date.now() + 90 * 24 * 60 * 60 * 1000;
    return rows.filter((r) => {
      const s = r.status.toUpperCase();
      if (s.includes('EXPIR')) return true;
      if (!r.endDate || !s.includes('ACTIVE')) return false;
      const end = new Date(r.endDate).getTime();
      return !Number.isNaN(end) && end <= in90 && end >= Date.now();
    });
  }, [rows]);
  const withSla = useMemo(
    () => rows.filter((r) => (r.slaTerms ?? '').trim().length > 0),
    [rows],
  );

  function cardStatus(c: CustomerContractView) {
    const s = c.status.toUpperCase();
    if (expiring.some((e) => e.id === c.id) && !s.includes('EXPIR')) {
      return 'EXPIRING';
    }
    return c.status;
  }

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Performance"
        title="SLA performance"
        subtitle="Contractual SLA terms plus live coverage, incidents, and complaints for your organisation — not a synthetic percentile score."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PortalStat
          label="Active services"
          value={loading ? '—' : (report?.slaPerformance?.activeContracts ?? active.length)}
          hint="ACTIVE contracts"
          tone="teal"
        />
        <PortalStat
          label="Expiring soon"
          value={loading ? '—' : (report?.slaPerformance?.expiringContracts ?? expiring.length)}
          hint="EXPIRING status"
          tone="amber"
        />
        <PortalStat
          label="Guards deployed"
          value={loading ? '—' : (report?.slaPerformance?.deployedGuards ?? '—')}
          hint={
            report?.slaPerformance
              ? `${report.slaPerformance.committedGuards} committed on live contracts`
              : `${withSla.length} contracts with SLA terms`
          }
          tone="sky"
        />
        <PortalStat
          label="Open incidents"
          value={loading ? '—' : (report?.slaPerformance?.incidentsStillOpen ?? '—')}
          hint={
            report?.slaPerformance
              ? `${report.slaPerformance.complaintsStillOpen} open complaints · ${report.slaPerformance.attendanceClockIns} clock-ins in period`
              : `${rows.length} contracts total`
          }
          tone="rose"
        />
      </div>

      {loading ? (
        <p className="text-sm text-[#605e5c]">Loading SLA pack…</p>
      ) : rows.length === 0 ? (
        <PortalEmpty
          title="No contracts yet"
          description="SLA cards appear once HIGHLINK attaches service agreements to your account."
          icon={<Gauge className="h-5 w-5" />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((c) => (
            <article
              key={c.id}
              className="rounded-2xl border border-[#e1dfdd] bg-white p-5 shadow-sm transition hover:border-[#0078d4]/50 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-[#605e5c]">
                    {c.contractNumber}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-[#1b1a19]">
                    {c.title}
                  </h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#0078d4]">
                    {c.serviceType}
                  </p>
                </div>
                <StatusPill status={cardStatus(c)} />
              </div>

              <div className="mt-4 rounded-xl bg-gradient-to-br from-[#eff6fc] to-teal-50/40 px-4 py-3 ring-1 ring-[#c7e0f4]">
                <div className="flex items-center gap-2 text-teal-800">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    SLA terms
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#323130]">
                  {(c.slaTerms ?? '').trim() ||
                    'No written SLA on this contract yet — ask your HIGHLINK account manager.'}
                </p>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#605e5c]">
                <div>
                  <dt className="uppercase">Period</dt>
                  <dd className="mt-0.5 font-medium text-[#323130]">
                    {formatDate(c.startDate)} → {formatDate(c.endDate)}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase">Monthly fee</dt>
                  <dd className="mt-0.5 font-medium text-[#323130]">
                    {money(c.monthlyFee, c.currency)}
                  </dd>
                </div>
                {c.guardCount != null && c.guardCount > 0 ? (
                  <div>
                    <dt className="uppercase">Guards committed</dt>
                    <dd className="mt-0.5 font-medium text-[#323130]">
                      {c.guardCount}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      )}

      <PortalDeferral note="Percentile response-time and missed-patrol SLA remain deferred. This page shows written contract terms plus live operational counts for your organisation only." />
    </div>
  );
}
