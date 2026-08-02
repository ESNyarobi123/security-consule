'use client';

import {
  listCustomerContracts,
  type CustomerContractView,
} from '@pssms/api-client';
import { FileText, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalStat,
  PortalToolbar,
  StatusPill,
  formatDate,
  money,
} from '../../_components/portal-ui';

function serviceLabel(c: CustomerContractView): string {
  const types =
    c.serviceTypes && c.serviceTypes.length > 0
      ? c.serviceTypes
      : c.serviceType
        ? [c.serviceType]
        : [];
  return types.map((s) => s.replace(/_/g, ' ')).join(', ') || '—';
}

export default function ContractsPage() {
  const [rows, setRows] = useState<CustomerContractView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState<'cards' | 'list'>('cards');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCustomerContracts();
      setRows(data as CustomerContractView[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: rows.length };
    for (const r of rows) {
      const key = r.status.toUpperCase().replace(/[\s-]+/g, '_');
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [rows]);

  const statusChips = useMemo(() => {
    const keys = Object.keys(counts).filter((k) => k !== 'ALL');
    return [
      { id: 'ALL', label: 'All', count: counts.ALL },
      ...keys.map((k) => ({
        id: k,
        label: k.replace(/_/g, ' '),
        count: counts[k],
      })),
    ];
  }, [counts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'ALL') {
        const s = r.status.toUpperCase().replace(/[\s-]+/g, '_');
        if (s !== statusFilter) return false;
      }
      if (!q) return true;
      const services = serviceLabel(r).toLowerCase();
      const siteText = (r.sites ?? [])
        .map((s) => `${s.code} ${s.name}`)
        .join(' ')
        .toLowerCase();
      return (
        r.contractNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.serviceType.toLowerCase().includes(q) ||
        services.includes(q) ||
        siteText.includes(q) ||
        (r.slaTerms ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const active = rows.filter((r) => r.status.toUpperCase().includes('ACTIVE')).length;
  const expiring = rows.filter((r) => {
    const s = r.status.toUpperCase();
    if (s.includes('EXPIR')) return true;
    if (!r.endDate || !s.includes('ACTIVE')) return false;
    const end = new Date(r.endDate).getTime();
    const in90 = Date.now() + 90 * 24 * 60 * 60 * 1000;
    return !Number.isNaN(end) && end <= in90 && end >= Date.now();
  }).length;

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Services · Portal 35.8"
        title="Contracts & SLA"
        subtitle="Service agreements for your sites — view only. Changes go through HIGHLINK commercial team."
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

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <PortalStat label="Total" value={loading ? '—' : rows.length} tone="sky" />
        <PortalStat label="Active" value={loading ? '—' : active} tone="teal" />
        <PortalStat
          label="Expiring soon"
          value={loading ? '—' : expiring}
          hint="Within 90 days"
          tone="amber"
        />
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search contract #, title, service, SLA…"
        filters={statusChips}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        view={view}
        onViewChange={setView}
      />

      {loading && rows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#edebe9]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PortalEmpty
          title="No contracts match"
          description="Try another status filter or ask your account manager to register a service agreement."
          icon={<FileText className="h-4 w-4" />}
        />
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <article
              key={c.id}
              className="flex flex-col rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:border-[#0078d4]/50 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-[#8a8886]">
                    {c.contractNumber}
                  </p>
                  <h3 className="mt-0.5 truncate text-sm font-semibold text-[#1b1a19]">
                    {c.title}
                  </h3>
                </div>
                <StatusPill status={c.status} />
              </div>
              <p className="mt-2 text-xs font-medium text-[#0078d4]">
                {serviceLabel(c)}
              </p>
              {c.sites && c.sites.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.sites.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-md bg-[#f3f2f1] px-1.5 py-0.5 text-[10px] font-medium text-[#323130]"
                      title={s.name}
                    >
                      <span className="font-mono text-[#0078d4]">{s.code}</span>
                      <span className="text-[#8a8886]"> · {s.name}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-lg font-bold tabular-nums text-[#1b1a19]">
                {money(c.monthlyFee, c.currency)}
                <span className="ml-1 text-xs font-medium text-[#605e5c]">/ mo</span>
              </p>
              <p className="mt-1 text-xs text-[#605e5c]">
                {formatDate(c.startDate)} → {formatDate(c.endDate)}
              </p>
              {c.slaTerms ? (
                <p className="mt-3 line-clamp-3 rounded-xl bg-[#faf9f8] px-3 py-2 text-xs text-[#323130] ring-1 ring-[#edebe9]">
                  {c.slaTerms}
                </p>
              ) : (
                <p className="mt-3 text-xs italic text-[#a19f9d]">
                  No SLA terms on file — request from account manager.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
          <div className="hidden border-b border-[#edebe9] bg-[#faf9f8] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a8886] md:grid md:grid-cols-[1.2fr_1fr_auto_auto_auto]">
            <span>Contract</span>
            <span>Service</span>
            <span>Fee</span>
            <span>Period</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-[#f3f2f1]">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="grid gap-2 px-4 py-3 md:grid-cols-[1.2fr_1fr_auto_auto_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1b1a19]">
                    {c.title}
                  </p>
                  <p className="font-mono text-[11px] text-[#8a8886]">
                    {c.contractNumber}
                  </p>
                </div>
                <p className="text-xs text-[#323130]">
                  {serviceLabel(c)}
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {money(c.monthlyFee, c.currency)}
                </p>
                <p className="text-xs text-[#605e5c]">
                  {formatDate(c.startDate)} – {formatDate(c.endDate)}
                </p>
                <StatusPill status={c.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <PortalDeferral note="Contract edits and renewals are processed by HIGHLINK commercial / Legal — not self-service in this portal." />
    </div>
  );
}
