'use client';

import {
  createCallCentreTicket,
  escalateCallCentreTicket,
  getCallCentreTicketOptions,
  getStaffServiceRequest,
  listCallCentreCustomerOptions,
  listCallCentreSiteOptions,
  listStaffServiceRequests,
  updateStaffServiceRequest,
  type CallCentreSiteOption,
  type StaffServiceRequest,
  type SupportCustomerOption,
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
import { RefreshCw, Search, Ticket, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const NEXT: Record<string, string[]> = {
  OPEN: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
};

const STATUSES = [
  'OPEN',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

const URGENCIES = ['SAME_DAY', 'THIS_WEEK', 'PLANNING'];

const OPEN_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'];

const label = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const when = (value?: string | null) =>
  value ? new Date(value).toLocaleString('en-GB') : '—';

function Field({
  label: fieldLabel,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8886]">
        {fieldLabel}
      </p>
      <div className="mt-0.5 text-sm text-[#1b1a19]">{children}</div>
    </div>
  );
}

export default function CallCentreTicketsPage() {
  const [rows, setRows] = useState<StaffServiceRequest[]>([]);
  const [customers, setCustomers] = useState<SupportCustomerOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [detail, setDetail] = useState<StaffServiceRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [closeRow, setCloseRow] = useState<StaffServiceRequest | null>(null);
  const [notes, setNotes] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [category, setCategory] = useState('PARKING');
  const [urgency, setUrgency] = useState('THIS_WEEK');
  const [sites, setSites] = useState<CallCentreSiteOption[]>([]);
  const [siteId, setSiteId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [callbackPhone, setCallbackPhone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, opts, cats] = await Promise.all([
        listStaffServiceRequests(),
        listCallCentreCustomerOptions(),
        getCallCentreTicketOptions().catch(() => null),
      ]);
      setRows(list);
      setCustomers(opts);
      const options = cats?.categories?.length ? cats.categories : [];
      setCategories(options);
      setCategory((prev) =>
        options.includes(prev) ? prev : options[0] ?? prev,
      );
      setCustomerId((prev) => prev || opts[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!customerId) {
      setSites([]);
      setSiteId('');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const pack = await listCallCentreSiteOptions(customerId);
        if (cancelled) return;
        setSites(pack.sites ?? []);
        setSiteId((prev) =>
          (pack.sites ?? []).some((s) => s.id === prev) ? prev : '',
        );
      } catch {
        if (!cancelled) setSites([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const stats = useMemo(() => {
    const open = rows.filter((r) => OPEN_STATUSES.includes(r.status)).length;
    const escalated = rows.filter((r) => r.incidentId).length;
    const done = rows.filter(
      (r) => r.status === 'RESOLVED' || r.status === 'CLOSED',
    ).length;
    return { open, escalated, done, total: rows.length };
  }, [rows]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter && r.category !== filter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (!term) return true;
      return [
        r.referenceNumber,
        r.title,
        r.customerCode,
        r.customerName,
        r.category,
        r.incidentNumber,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, filter, statusFilter, search]);

  async function openDetail(row: StaffServiceRequest) {
    setDetail(row);
    setDetailLoading(true);
    try {
      const fresh = await getStaffServiceRequest(row.id);
      setDetail(fresh);
    } catch {
      // The list row already carries the description — keep showing it.
    } finally {
      setDetailLoading(false);
    }
  }

  async function advance(row: StaffServiceRequest, status: string) {
    setError(null);
    setNotice(null);
    if (status === 'CLOSED') {
      setCloseRow(row);
      setNotes(row.resolutionNotes ?? '');
      return;
    }
    setBusy(true);
    try {
      const updated = await updateStaffServiceRequest(row.id, { status });
      if (detail?.id === updated.id) setDetail(updated);
      setNotice(`${row.referenceNumber} moved to ${label(status)}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function escalate(row: StaffServiceRequest) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await escalateCallCentreTicket(row.id);
      setNotice(
        `${row.referenceNumber} escalated to incident ${res.incidentNumber}. Branch Ops owns it from here.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Escalate failed');
    } finally {
      setBusy(false);
    }
  }

  const transitions = (row: StaffServiceRequest) =>
    row.allowedNextStatuses?.length
      ? row.allowedNextStatuses
      : NEXT[row.status] ?? [];

  const creatorBlocked = (row: StaffServiceRequest) => row.canProcess === false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5c2d91]">
            Portal 35.20 · Support tickets
          </p>
          <h1 className="mt-0.5 text-xl font-semibold text-[#1b1a19]">
            Support tickets
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-[#605e5c]">
            Log inbound parking, supplier, payroll, visitor, coverage, billing and
            incident inquiries. Owning ledgers stay on those portals. Escalate to
            an OPEN incident for Branch Ops. Open a row to read the full
            description. Creator cannot process their own ticket.
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open tickets"
          value={loading ? '…' : stats.open}
          hint="Open / acknowledged / in progress"
          icon={<Ticket className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Escalated to Branch Ops"
          value={loading ? '…' : stats.escalated}
          hint="Linked to an incident"
          icon={<TriangleAlert className="h-5 w-5" />}
          accent="rose"
        />
        <StatCard
          label="Resolved / closed"
          value={loading ? '…' : stats.done}
          hint="Kept for the audit trail"
          accent="emerald"
        />
        <StatCard
          label="Total tickets"
          value={loading ? '…' : stats.total}
          hint="All support categories"
          accent="violet"
        />
      </div>

      <div className="rounded-md border border-[#e1dfdd] p-3">
        <p className="mb-2 text-sm font-semibold text-[#1b1a19]">Log a ticket</p>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <select
            className={inputCls + ' mt-0'}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
          <select
            className={inputCls + ' mt-0'}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
          <select
            className={inputCls + ' mt-0'}
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
          >
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {label(u)}
              </option>
            ))}
          </select>
          <input
            className={inputCls + ' mt-0'}
            placeholder="Callback phone (optional)"
            value={callbackPhone}
            onChange={(e) => setCallbackPhone(e.target.value)}
          />
          <select
            className={inputCls + ' mt-0'}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            title="Binding a site lets this ticket escalate into a Branch Ops incident"
          >
            <option value="">Site (optional — needed to escalate)</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
          <input
            className={inputCls + ' mt-0 md:col-span-2'}
            placeholder="Ticket title (min 3 chars)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={inputCls + ' mt-0 md:col-span-2'}
            rows={2}
            placeholder="What is the customer asking for? (min 10 chars)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            className={btnPrimary + ' md:col-span-2 lg:col-span-1'}
            disabled={
              busy ||
              !customerId ||
              title.trim().length < 3 ||
              description.trim().length < 10
            }
            onClick={() =>
              void (async () => {
                setBusy(true);
                setError(null);
                setNotice(null);
                try {
                  const created = await createCallCentreTicket({
                    customerId,
                    category,
                    urgency,
                    title: title.trim(),
                    description: description.trim(),
                    siteId: siteId || undefined,
                    callbackPhone: callbackPhone.trim() || undefined,
                  });
                  setTitle('');
                  setDescription('');
                  setCallbackPhone('');
                  setNotice(
                    `${created.referenceNumber} logged — open it to re-read the description.`,
                  );
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Create failed');
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Log ticket
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={inputCls + ' mt-0 w-auto'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
        </select>
        <select
          className={inputCls + ' mt-0 w-auto'}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8886]" />
          <input
            className={inputCls + ' mt-0 w-64 pl-7'}
            placeholder="Search ref, title, customer, incident"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-[#8a8886]">
          {shown.length} of {rows.length}
        </span>
      </div>

      <DataTable
        loading={loading}
        keyField="id"
        rows={shown}
        emptyMessage="No tickets match this filter"
        columns={[
          { key: 'referenceNumber', label: 'Ref' },
          {
            key: 'customerCode',
            label: 'Customer',
            render: (r) => r.customerCode ?? '—',
          },
          {
            key: 'title',
            label: 'Title',
            render: (r) => (
              <button
                type="button"
                className="text-left font-medium text-[#0067b8] hover:underline"
                onClick={() => void openDetail(r)}
              >
                {r.title}
              </button>
            ),
          },
          {
            key: 'category',
            label: 'Category',
            render: (r) => label(r.category),
          },
          {
            key: 'urgency',
            label: 'Urgency',
            render: (r) => label(r.urgency),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'incidentNumber',
            label: 'Incident',
            render: (r) => r.incidentNumber ?? '—',
          },
          {
            key: 'id',
            label: 'Actions',
            render: (r) => (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-xs font-medium text-[#0067b8] hover:underline"
                  onClick={() => void openDetail(r)}
                >
                  View
                </button>
                {creatorBlocked(r) ? (
                  <span className="text-[11px] text-[#8a8886]">
                    You logged this
                  </span>
                ) : (
                  <>
                    {transitions(r).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="text-xs font-medium text-[#0067b8] hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void advance(r, s)}
                      >
                        {label(s)}
                      </button>
                    ))}
                    {!r.incidentId &&
                    r.status !== 'CLOSED' &&
                    r.status !== 'CANCELLED' ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-rose-700 hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void escalate(r)}
                      >
                        Escalate incident
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ),
          },
        ]}
      />

      {detail ? (
        <Modal
          title={`${detail.referenceNumber} · ${detail.title}`}
          onClose={() => setDetail(null)}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              <span className="rounded-full bg-[#f3f2f1] px-2 py-0.5 text-[11px] font-medium text-[#323130]">
                {label(detail.category)}
              </span>
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200">
                {label(detail.urgency)}
              </span>
              {detail.incidentNumber ? (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800 ring-1 ring-rose-200">
                  Incident {detail.incidentNumber}
                </span>
              ) : null}
              {detail.isCreator ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                  You logged this — another officer must process it
                </span>
              ) : null}
              {detailLoading ? (
                <span className="text-[11px] text-[#8a8886]">Refreshing…</span>
              ) : null}
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8886]">
                Description
              </p>
              <p className="mt-1 whitespace-pre-wrap rounded-md border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm text-[#1b1a19]">
                {detail.description}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer">
                {detail.customerCode
                  ? `${detail.customerCode}${detail.customerName ? ` · ${detail.customerName}` : ''}`
                  : '—'}
              </Field>
              <Field label="Site">
                {detail.siteName
                  ? `${detail.siteCode ?? ''} · ${detail.siteName}`
                  : 'Not linked to a site'}
              </Field>
              <Field label="Callback phone">
                {detail.callbackPhone ?? '—'}
              </Field>
              <Field label="Logged by">
                {detail.createdByName ?? '—'} · {when(detail.createdAt)}
              </Field>
              <Field label="Acknowledged by">
                {detail.acknowledgedByName
                  ? `${detail.acknowledgedByName} · ${when(detail.acknowledgedAt)}`
                  : '—'}
              </Field>
              <Field label="Resolved by">
                {detail.resolvedByName
                  ? `${detail.resolvedByName} · ${when(detail.resolvedAt)}`
                  : '—'}
              </Field>
              <Field label="Closed by">
                {detail.closedByName
                  ? `${detail.closedByName} · ${when(detail.closedAt)}`
                  : '—'}
              </Field>
              <Field label="Escalation">
                {detail.incidentNumber
                  ? `Incident ${detail.incidentNumber} — see Branch Ops / Incidents`
                  : 'Not escalated'}
              </Field>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8886]">
                Resolution notes
              </p>
              <p className="mt-1 whitespace-pre-wrap rounded-md border border-[#e1dfdd] px-3 py-2 text-sm text-[#1b1a19]">
                {detail.resolutionNotes || 'No resolution notes yet.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[#e1dfdd] pt-3">
              {creatorBlocked(detail) ? (
                <p className="text-xs text-[#605e5c]">
                  Separation of duty: the officer who logged this ticket cannot
                  acknowledge, resolve, close, or escalate it.
                </p>
              ) : (
                <>
                  {transitions(detail).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={s === 'CLOSED' ? btnSecondary : btnPrimary}
                      disabled={busy}
                      onClick={() => void advance(detail, s)}
                    >
                      {label(s)}
                    </button>
                  ))}
                  {!detail.incidentId &&
                  detail.status !== 'CLOSED' &&
                  detail.status !== 'CANCELLED' ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={busy}
                      onClick={() => void escalate(detail)}
                    >
                      Escalate incident
                    </button>
                  ) : null}
                </>
              )}
              <button
                type="button"
                className={btnSecondary + ' ml-auto'}
                onClick={() => setDetail(null)}
              >
                Close panel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {closeRow ? (
        <Modal
          title={`Close ${closeRow.referenceNumber}`}
          onClose={() => setCloseRow(null)}
          size="sm"
        >
          <p className="mb-2 text-xs text-[#605e5c]">
            Resolution notes are required and stay on the audit trail.
          </p>
          <textarea
            className={inputCls}
            rows={4}
            placeholder="What was done to resolve this ticket?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="button"
            className={btnSecondary + ' mt-2'}
            disabled={busy || notes.trim().length < 2}
            onClick={() =>
              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  const updated = await updateStaffServiceRequest(closeRow.id, {
                    status: 'CLOSED',
                    resolutionNotes: notes.trim(),
                  });
                  if (detail?.id === updated.id) setDetail(updated);
                  setCloseRow(null);
                  setNotice(`${updated.referenceNumber} closed.`);
                  await load();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'Failed to close ticket',
                  );
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Close ticket
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
