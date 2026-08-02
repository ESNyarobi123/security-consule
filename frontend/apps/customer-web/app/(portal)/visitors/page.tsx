'use client';

import {
  approveCustomerVisitor,
  listCustomerVisitors,
  rejectCustomerVisitor,
  type VisitorAppointment,
} from '@pssms/api-client';
import { Check, RefreshCw, Users, X } from 'lucide-react';
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
} from '../../_components/portal-ui';

function isPending(status: string) {
  return status.toUpperCase().replace(/[\s-]+/g, '_').includes('PEND');
}

export default function VisitorsPage() {
  const [rows, setRows] = useState<VisitorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [codeModal, setCodeModal] = useState<{
    visitorName: string;
    code: string;
  } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<VisitorAppointment | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCustomerVisitors());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visitors');
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

  const pending = Object.entries(counts)
    .filter(([k]) => k.includes('PEND') || k.includes('AWAIT') || k.includes('REQUEST'))
    .reduce((n, [, c]) => n + c, 0);
  const approved = Object.entries(counts)
    .filter(([k]) => k.includes('APPROV') || k.includes('ACTIVE') || k.includes('CHECKED'))
    .reduce((n, [, c]) => n + c, 0);

  const filters = useMemo(() => {
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
      return (
        (r.visitorName ?? '').toLowerCase().includes(q) ||
        (r.hostName ?? '').toLowerCase().includes(q) ||
        (r.referenceNumber ?? '').toLowerCase().includes(q) ||
        (r.purpose ?? '').toLowerCase().includes(q) ||
        (r.siteCode ?? '').toLowerCase().includes(q) ||
        (r.siteName ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  async function approve(v: VisitorAppointment) {
    setActingId(v.id);
    setError(null);
    try {
      const res = await approveCustomerVisitor(v.id);
      setCodeModal({
        visitorName: v.visitorName,
        code: res.verificationCode,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setActingId(null);
    }
  }

  async function submitReject() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError('Rejection reason is required');
      return;
    }
    setActingId(rejectTarget.id);
    setError(null);
    try {
      await rejectCustomerVisitor(rejectTarget.id, { reason });
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setActingId(null);
    }
  }

  function HostActions({
    v,
    compact,
  }: {
    v: VisitorAppointment;
    compact?: boolean;
  }) {
    if (!isPending(v.status)) return null;
    const busy = actingId === v.id;
    return (
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'mt-3'}`}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void approve(v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#107c10] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0b5a0b] disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setRejectTarget(v);
            setRejectReason('');
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d13438]/40 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#d13438] hover:bg-[#fde7e9] disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Site ops · Portal 35.8"
        title="Visitors"
        subtitle="Host-approve appointments and issue gate verification codes for your sites."
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
        <PortalStat label="Appointments" value={loading ? '—' : rows.length} tone="sky" />
        <PortalStat label="Pending" value={loading ? '—' : pending} tone="amber" />
        <PortalStat label="Approved / active" value={loading ? '—' : approved} tone="teal" />
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search visitor, host, site, reference…"
        filters={filters}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        view={view}
        onViewChange={setView}
      />

      {loading && rows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#edebe9]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PortalEmpty
          title="No visitor appointments"
          description="Appointments booked for your sites appear here for host approval."
          icon={<Users className="h-4 w-4" />}
        />
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <article
              key={v.id}
              className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:border-[#0078d4]/40 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <AvatarBadge
                  seed={v.id}
                  label={initials(v.visitorName || 'V', 'V')}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1b1a19]">
                        {v.visitorName}
                      </p>
                      <p className="font-mono text-[11px] text-[#8a8886]">
                        {v.referenceNumber}
                      </p>
                    </div>
                    <StatusPill status={v.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-[#605e5c]">
                    {v.purpose || '—'}
                  </p>
                  <p className="mt-2 text-xs text-[#323130]">
                    Host: {v.hostName ?? '—'}
                    {v.siteCode || v.siteName
                      ? ` · ${[v.siteCode, v.siteName].filter(Boolean).join(' ')}`
                      : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8a8886]">
                    {formatDate(v.validFrom, true)} → {formatDate(v.validUntil, true)}
                  </p>
                  <HostActions v={v} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
          <ul className="divide-y divide-[#f3f2f1]">
            {filtered.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AvatarBadge
                    seed={v.id}
                    label={initials(v.visitorName || 'V', 'V')}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{v.visitorName}</p>
                    <p className="truncate text-xs text-[#605e5c]">
                      {v.referenceNumber}
                      {v.siteCode ? ` · ${v.siteCode}` : ''}
                      {' · '}
                      {v.purpose}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hidden text-xs text-[#605e5c] sm:inline">
                    {formatDate(v.validFrom)}
                  </span>
                  <StatusPill status={v.status} />
                  <HostActions v={v} compact />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PortalDeferral note="Gate scan and deny-on-bad-code stay with HIGHLINK gate officers. Host approve here issues the one-time verification code (SMS when phone is on file)." />

      {codeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[#1b1a19]">
              Gate verification code
            </h2>
            <p className="mt-1 text-sm text-[#605e5c]">
              Issued for <strong>{codeModal.visitorName}</strong>. Share with the
              visitor — shown once.
            </p>
            <p className="mt-4 rounded-xl bg-[#f3f2f1] py-4 text-center font-mono text-3xl font-bold tracking-[0.2em] text-[#0078d4]">
              {codeModal.code}
            </p>
            <button
              type="button"
              onClick={() => setCodeModal(null)}
              className="mt-5 w-full rounded-lg bg-[#0078d4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#106ebe]"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[#1b1a19]">
              Reject appointment
            </h2>
            <p className="mt-1 text-sm text-[#605e5c]">
              {rejectTarget.visitorName} · {rejectTarget.referenceNumber}
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
              Reason
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-[#e1dfdd] px-3 py-2 text-sm text-[#1b1a19] outline-none focus:border-[#0078d4]"
                placeholder="Why is this visit declined?"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason('');
                }}
                className="rounded-lg border border-[#e1dfdd] px-3 py-2 text-sm font-semibold text-[#323130] hover:bg-[#f3f2f1]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actingId === rejectTarget.id || !rejectReason.trim()}
                onClick={() => void submitReject()}
                className="rounded-lg bg-[#d13438] px-3 py-2 text-sm font-semibold text-white hover:bg-[#a4262c] disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
