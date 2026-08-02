'use client';

import { listCustomerInvoices, type Invoice } from '@pssms/api-client';
import { FileText, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AvatarBadge,
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalStat,
  PortalToolbar,
  StatusPill,
  formatDate,
  initials,
  money,
} from '../../_components/portal-ui';

function isOpen(status: string) {
  const s = status.toUpperCase();
  return !s.includes('PAID') && !s.includes('CLOSED') && !s.includes('CANCEL') && !s.includes('VOID');
}

function isOverdue(inv: Invoice) {
  const s = inv.status.toUpperCase();
  if (s.includes('OVERDUE')) return true;
  if (!isOpen(inv.status) || !inv.dueDate) return false;
  const due = new Date(inv.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now() && inv.totalAmount > inv.amountPaid;
}

function isPaid(status: string) {
  return status.toUpperCase().includes('PAID') && !status.toUpperCase().includes('PARTIAL');
}

function PayProgress({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#edebe9]">
      <div
        className={`h-full rounded-full ${
          pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-[#0078d4]' : 'bg-transparent'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState<'cards' | 'list'>('cards');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCustomerInvoices());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCount = rows.filter((r) => isOpen(r.status)).length;
  const overdueCount = rows.filter(isOverdue).length;
  const paidCount = rows.filter((r) => isPaid(r.status)).length;

  const filters = [
    { id: 'ALL', label: 'All', count: rows.length },
    { id: 'OPEN', label: 'Open', count: openCount },
    { id: 'OVERDUE', label: 'Overdue', count: overdueCount },
    { id: 'PAID', label: 'Paid', count: paidCount },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'OPEN' && !isOpen(r.status)) return false;
      if (statusFilter === 'OVERDUE' && !isOverdue(r)) return false;
      if (statusFilter === 'PAID' && !isPaid(r.status)) return false;
      if (!q) return true;
      return (
        (r.invoiceNumber ?? '').toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Finance · Portal 35.8"
        title="Invoices & payments"
        subtitle="Billing for your security services — amounts, status and due dates for your organisation only."
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
        <PortalStat label="Open" value={loading ? '—' : openCount} tone="amber" />
        <PortalStat label="Overdue" value={loading ? '—' : overdueCount} tone="rose" />
        <PortalStat label="Paid" value={loading ? '—' : paidCount} tone="emerald" />
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search invoice #…"
        filters={filters}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        view={view}
        onViewChange={setView}
      />

      {loading && rows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-[#edebe9]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PortalEmpty
          title="No invoices"
          description="Invoices appear here once HIGHLINK finance issues billing for your contracts."
          icon={<FileText className="h-4 w-4" />}
        />
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((inv) => {
            const bal = Math.max(inv.totalAmount - inv.amountPaid, 0);
            const pct =
              inv.totalAmount > 0
                ? Math.min(100, Math.round((inv.amountPaid / inv.totalAmount) * 100))
                : 0;
            return (
              <article
                key={inv.id}
                className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:border-[#0078d4]/40 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <AvatarBadge
                    seed={inv.id}
                    label={initials(inv.invoiceNumber || 'IN', 'IN')}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-mono text-sm font-semibold text-[#1b1a19]">
                        {inv.invoiceNumber}
                      </p>
                      <StatusPill status={inv.status} />
                    </div>
                    <p className="mt-2 text-lg font-bold tabular-nums text-[#1b1a19]">
                      {money(inv.totalAmount, inv.currency)}
                    </p>
                    <PayProgress paid={inv.amountPaid} total={inv.totalAmount} />
                    <p className="mt-1 text-[11px] text-[#8a8886]">
                      {pct}% paid · Bal {money(bal, inv.currency)}
                    </p>
                    <p
                      className={`mt-2 text-xs ${
                        isOverdue(inv) ? 'font-semibold text-rose-700' : 'text-[#605e5c]'
                      }`}
                    >
                      Issued {formatDate(inv.issueDate)} · Due{' '}
                      {formatDate(inv.dueDate)}
                    </p>
                    {inv.notes?.trim() ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#8a8886]">
                        {inv.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
          <div className="hidden border-b border-[#edebe9] bg-[#faf9f8] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a8886] md:grid md:grid-cols-[1.2fr_1fr_auto_auto_auto_auto]">
            <span>Invoice</span>
            <span>Total</span>
            <span>Paid</span>
            <span>Balance</span>
            <span>Issued → Due</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-[#f3f2f1]">
            {filtered.map((inv) => {
              const bal = Math.max(inv.totalAmount - inv.amountPaid, 0);
              return (
                <li
                  key={inv.id}
                  className="grid gap-2 px-4 py-3 md:grid-cols-[1.2fr_1fr_auto_auto_auto_auto] md:items-center"
                >
                  <div className="flex items-center gap-3">
                    <AvatarBadge
                      seed={inv.id}
                      label={initials(inv.invoiceNumber || 'IN', 'IN')}
                      size="sm"
                    />
                    <p className="font-mono text-sm font-semibold">{inv.invoiceNumber}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {money(inv.totalAmount, inv.currency)}
                  </p>
                  <p className="text-sm tabular-nums text-emerald-700">
                    {money(inv.amountPaid, inv.currency)}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-amber-900">
                    {money(bal, inv.currency)}
                  </p>
                  <p
                    className={`text-xs ${
                      isOverdue(inv) ? 'font-semibold text-rose-700' : 'text-[#605e5c]'
                    }`}
                  >
                    {formatDate(inv.issueDate)} → {formatDate(inv.dueDate)}
                  </p>
                  <StatusPill status={inv.status} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <PortalDeferral note="Read-only view. Payments are recorded by HIGHLINK finance — contact your account manager for remittance details." />
    </div>
  );
}
