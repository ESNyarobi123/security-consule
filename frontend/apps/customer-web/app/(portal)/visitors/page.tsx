'use client';

import {
  approveCustomerVisitor,
  getCustomerAttachedDocumentUrl,
  getCustomerPortalVisitorEntries,
  listCustomerVisitorAppointmentDocuments,
  listCustomerVisitors,
  rejectCustomerVisitor,
  type GateCodeDelivery,
  type PortalVisitorEntry,
  type VisitorAppointment,
} from '@pssms/api-client';
import { Check, FileImage, RefreshCw, Users, X } from 'lucide-react';
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

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type VisitorDoc = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export default function VisitorsPage() {
  const [rows, setRows] = useState<VisitorAppointment[]>([]);
  const [entries, setEntries] = useState<PortalVisitorEntry[]>([]);
  const [tab, setTab] = useState<'appointments' | 'logs'>('appointments');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [codeModal, setCodeModal] = useState<{
    visitorName: string;
    code: string;
    delivery?: GateCodeDelivery;
  } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<VisitorAppointment | null>(
    null,
  );
  const [docsTarget, setDocsTarget] = useState<VisitorAppointment | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointments, gateLogs] = await Promise.all([
        listCustomerVisitors(),
        getCustomerPortalVisitorEntries(),
      ]);
      setRows(appointments);
      setEntries(gateLogs);
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

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.visitorName.toLowerCase().includes(q) ||
        (e.siteCode ?? '').toLowerCase().includes(q) ||
        (e.siteName ?? '').toLowerCase().includes(q) ||
        (e.gateCode ?? '').toLowerCase().includes(q) ||
        (e.referenceNumber ?? '').toLowerCase().includes(q) ||
        e.result.toLowerCase().includes(q) ||
        e.direction.toLowerCase().includes(q),
    );
  }, [entries, search]);

  async function approve(v: VisitorAppointment) {
    setActingId(v.id);
    setError(null);
    try {
      const res = await approveCustomerVisitor(v.id);
      setCodeModal({
        visitorName: v.visitorName,
        code: res.verificationCode,
        delivery: res.delivery,
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
    const busy = actingId === v.id;
    const pending = isPending(v.status);
    return (
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'mt-3'}`}>
        <button
          type="button"
          onClick={() => setDocsTarget(v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e1dfdd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0078d4] hover:bg-[#deecf9]"
        >
          <FileImage className="h-3.5 w-3.5" />
          ID scans
        </button>
        {pending ? (
          <>
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
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Site ops · Portal 35.8"
        title="Visitors"
        subtitle="Host-approve appointments and review gate entry/exit logs for your sites only."
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

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStat label="Appointments" value={loading ? '—' : rows.length} tone="sky" />
        <PortalStat label="Pending" value={loading ? '—' : pending} tone="amber" />
        <PortalStat label="Approved / active" value={loading ? '—' : approved} tone="teal" />
        <PortalStat
          label="Gate logs"
          value={loading ? '—' : entries.length}
          hint="Latest 100 at your sites"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('appointments')}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === 'appointments'
              ? 'bg-[#0078d4] text-white'
              : 'border border-[#e1dfdd] bg-white text-[#323130] hover:bg-[#f3f2f1]'
          }`}
        >
          Appointments
        </button>
        <button
          type="button"
          onClick={() => setTab('logs')}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === 'logs'
              ? 'bg-[#0078d4] text-white'
              : 'border border-[#e1dfdd] bg-white text-[#323130] hover:bg-[#f3f2f1]'
          }`}
        >
          Gate logs
        </button>
      </div>

      {tab === 'appointments' ? (
        <>
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
                  {v.idType && v.idNumber ? (
                    <p className="mt-1.5 inline-flex items-center rounded-md bg-[#f3f2f1] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#323130]">
                      {v.idType.replace(/_/g, ' ')} · {v.idNumber}
                    </p>
                  ) : null}
                  {v.visitKind ? (
                    <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-[#0078d4]">
                      {v.visitKind.replace(/_/g, ' ')}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-[#323130]">
                    Host: {v.hostName ?? '—'}
                    {v.siteCode || v.siteName
                      ? ` · ${[v.siteCode, v.siteName].filter(Boolean).join(' ')}`
                      : ''}
                    {v.vehiclePlate ? ` · Vehicle ${v.vehiclePlate}` : ''}
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
                      {v.idType && v.idNumber
                        ? ` · ${v.idType} ${v.idNumber}`
                        : ''}
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
        </>
      ) : (
        <>
          <PortalToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search visitor, site, gate, result…"
          />
          {loading && entries.length === 0 ? (
            <p className="text-sm text-[#605e5c]">Loading gate logs…</p>
          ) : filteredEntries.length === 0 ? (
            <PortalEmpty
              title="No gate logs"
              description="Entry and exit punches at your sites appear here. Appointments remain on the other tab."
              icon={<Users className="h-4 w-4" />}
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-[#605e5c]">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Visitor</th>
                    <th className="px-3 py-2">Site / gate</th>
                    <th className="px-3 py-2">Dir</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e) => (
                    <tr key={e.id} className="border-t border-[#edebe9]">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-[#605e5c]">
                        {formatDate(e.recordedAt, true)}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-[#323130]">{e.visitorName}</p>
                        {e.referenceNumber ? (
                          <p className="font-mono text-[11px] text-[#8a8886]">
                            {e.referenceNumber}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-[#605e5c]">
                        {e.siteCode ?? e.siteName ?? '—'}
                        {e.gateCode ? ` · ${e.gateCode}` : ''}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={e.direction} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={e.result} />
                        {e.denyReason ? (
                          <p className="mt-1 text-[11px] text-[#d13438]">
                            {e.denyReason}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <PortalDeferral note="Gate scan and deny-on-bad-code stay with HIGHLINK gate officers. This log is scoped to your sites only — not the company-wide visitor register. Host approve issues the one-time code and queues Email / SMS / WhatsApp when contact details are on file. ID scan files are view-only here." />

      {docsTarget ? (
        <VisitorIdScansModal
          appointment={docsTarget}
          onClose={() => setDocsTarget(null)}
        />
      ) : null}

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
            {codeModal.delivery &&
            (codeModal.delivery.email ||
              codeModal.delivery.sms ||
              codeModal.delivery.whatsapp) ? (
              <ul className="mt-3 space-y-1 text-sm text-[#107c10]">
                {codeModal.delivery.email ? (
                  <li>Code emailed to visitor</li>
                ) : null}
                {codeModal.delivery.sms ? (
                  <li>SMS queued to visitor phone</li>
                ) : null}
                {codeModal.delivery.whatsapp ? (
                  <li>WhatsApp queued to visitor phone</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#605e5c]">
                No email or phone on file — share this code with the visitor
                manually.
              </p>
            )}
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

function VisitorIdScansModal({
  appointment,
  onClose,
}: {
  appointment: VisitorAppointment;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<VisitorDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listCustomerVisitorAppointmentDocuments(appointment.id)
      .then((rows) => {
        if (!cancelled) setDocs(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load ID scans');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointment.id]);

  async function onOpen(doc: VisitorDoc) {
    setDownloadingId(doc.id);
    setError(null);
    try {
      const { url } = await getCustomerAttachedDocumentUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[#1b1a19]">ID scans</h2>
        <p className="mt-1 text-sm text-[#605e5c]">
          {appointment.visitorName} · {appointment.referenceNumber}
        </p>
        <p className="mt-2 text-xs text-[#8a8886]">
          Read-only view of MinIO attachments uploaded by HIGHLINK staff. Portal
          hosts cannot upload.
        </p>
        {error ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <div className="mt-4 max-h-64 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-[#605e5c]">Loading…</p>
          ) : docs.length === 0 ? (
            <p className="text-xs text-[#605e5c]">No ID scans on file yet.</p>
          ) : (
            <ul className="divide-y divide-[#f3f2f1] rounded-xl border border-[#e1dfdd]">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#323130]">
                      {d.fileName}
                    </p>
                    <p className="text-[11px] text-[#8a8886]">
                      {d.contentType} · {formatBytes(d.sizeBytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={downloadingId === d.id}
                    onClick={() => void onOpen(d)}
                    className="shrink-0 text-xs font-semibold text-[#0078d4] hover:underline disabled:opacity-50"
                  >
                    {downloadingId === d.id ? '…' : 'Open'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-[#0078d4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#106ebe]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
