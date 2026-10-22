'use client';

import {
  createStaffComplaint,
  getCallCentreComplaintOptions,
  getStaffComplaint,
  listCallCentreCustomerOptions,
  listStaffComplaints,
  updateStaffComplaint,
  type CallCentreComplaintOptions,
  type StaffComplaint,
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
import { MessageSquareWarning, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const CMP_NEXT: Record<string, string[]> = {
  OPEN: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['UNDER_REVIEW', 'RESOLVED', 'CLOSED'],
  UNDER_REVIEW: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
};

const FALLBACK_CATEGORIES = [
  'SERVICE_QUALITY',
  'GUARD_CONDUCT',
  'ATTENDANCE',
  'BILLING',
  'CONTRACT',
  'PARKING',
  'VISITOR',
  'ACCESS',
  'OTHER',
];

const FALLBACK_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const OPEN_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW'];

const label = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const when = (value?: string | null) =>
  value ? new Date(value).toLocaleString('en-GB') : '—';

const SEVERITY_TONE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
  MEDIUM: 'bg-amber-50 text-amber-800 ring-amber-200',
  HIGH: 'bg-orange-50 text-orange-800 ring-orange-200',
  CRITICAL: 'bg-rose-50 text-rose-800 ring-rose-200',
};

function SeverityChip({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
        SEVERITY_TONE[severity] ?? 'bg-slate-100 text-slate-700 ring-slate-200'
      }`}
    >
      {label(severity)}
    </span>
  );
}

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

export default function CallCentreComplaintsPage() {
  const [rows, setRows] = useState<StaffComplaint[]>([]);
  const [customers, setCustomers] = useState<SupportCustomerOption[]>([]);
  const [options, setOptions] = useState<CallCentreComplaintOptions>({
    categories: FALLBACK_CATEGORIES,
    severities: FALLBACK_SEVERITIES,
    statuses: [],
    notes: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  const [detail, setDetail] = useState<StaffComplaint | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [closeRow, setCloseRow] = useState<StaffComplaint | null>(null);
  const [notes, setNotes] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [category, setCategory] = useState('SERVICE_QUALITY');
  const [severity, setSeverity] = useState('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [callbackPhone, setCallbackPhone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, opts, catalog] = await Promise.all([
        listStaffComplaints(),
        listCallCentreCustomerOptions(),
        getCallCentreComplaintOptions().catch(() => null),
      ]);
      setRows(list);
      setCustomers(opts);
      if (catalog) {
        setOptions({
          categories: catalog.categories?.length
            ? catalog.categories
            : FALLBACK_CATEGORIES,
          severities: catalog.severities?.length
            ? catalog.severities
            : FALLBACK_SEVERITIES,
          statuses: catalog.statuses ?? [],
          notes: catalog.notes ?? [],
        });
        setSeverity((prev) =>
          (catalog.severities ?? []).includes(prev)
            ? prev
            : catalog.severities?.[1] ?? prev,
        );
        setCategory((prev) =>
          (catalog.categories ?? []).includes(prev)
            ? prev
            : catalog.categories?.[0] ?? prev,
        );
      }
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

  const stats = useMemo(() => {
    const count = (status: string) =>
      rows.filter((r) => r.status === status).length;
    return {
      open: rows.filter((r) => OPEN_STATUSES.includes(r.status)).length,
      newOpen: count('OPEN'),
      review: count('ACKNOWLEDGED') + count('UNDER_REVIEW'),
      done: count('RESOLVED') + count('CLOSED'),
      critical: rows.filter(
        (r) =>
          r.severity === 'CRITICAL' && OPEN_STATUSES.includes(r.status),
      ).length,
    };
  }, [rows]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter && r.status !== filter) return false;
      if (!term) return true;
      return [
        r.referenceNumber,
        r.title,
        r.customerCode,
        r.customerName,
        r.category,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, filter, search]);

  async function openDetail(row: StaffComplaint) {
    setDetail(row);
    setDetailLoading(true);
    try {
      const fresh = await getStaffComplaint(row.id);
      setDetail(fresh);
    } catch {
      // The list row already carries the description — keep showing it.
    } finally {
      setDetailLoading(false);
    }
  }

  async function advance(row: StaffComplaint, status: string) {
    setError(null);
    setNotice(null);
    if (status === 'CLOSED') {
      setCloseRow(row);
      setNotes(row.resolutionNotes ?? '');
      return;
    }
    setBusy(true);
    try {
      const updated = await updateStaffComplaint(row.id, { status });
      if (detail?.id === updated.id) setDetail(updated);
      setNotice(`${row.referenceNumber} moved to ${label(status)}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  const transitions = (row: StaffComplaint) =>
    row.allowedNextStatuses?.length
      ? row.allowedNextStatuses
      : CMP_NEXT[row.status] ?? [];

  const creatorBlocked = (row: StaffComplaint) => row.canProcess === false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5c2d91]">
            Portal 35.20 · Complaints register
          </p>
          <h1 className="mt-0.5 text-xl font-semibold text-[#1b1a19]">
            Customer complaints
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-[#605e5c]">
            Call Centre Agents, Customer Support Officers, Helpdesk Officers, and
            Supervisors log and triage complaints here. Open a row to read the
            full description. Creator cannot acknowledge or close their own
            complaint.
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
          label="Open complaints"
          value={loading ? '…' : stats.open}
          hint={`${stats.newOpen} untouched · ${stats.critical} critical`}
          icon={<MessageSquareWarning className="h-5 w-5" />}
          accent="rose"
        />
        <StatCard
          label="Under review"
          value={loading ? '…' : stats.review}
          hint="Acknowledged or being investigated"
          accent="amber"
        />
        <StatCard
          label="Resolved / closed"
          value={loading ? '…' : stats.done}
          hint="Kept for the audit trail"
          accent="emerald"
        />
        <StatCard
          label="Total logged"
          value={loading ? '…' : rows.length}
          hint="Customer complaint register (Module 6-B)"
          accent="blue"
        />
      </div>

      <div className="rounded-md border border-[#e1dfdd] p-3">
        <p className="mb-2 text-sm font-semibold text-[#1b1a19]">
          Log a complaint
        </p>
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
            {options.categories.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
          <select
            className={inputCls + ' mt-0'}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {options.severities.map((s) => (
              <option key={s} value={s}>
                {label(s)} severity
              </option>
            ))}
          </select>
          <input
            className={inputCls + ' mt-0'}
            placeholder="Callback phone (optional)"
            value={callbackPhone}
            onChange={(e) => setCallbackPhone(e.target.value)}
          />
          <input
            className={inputCls + ' mt-0 md:col-span-2'}
            placeholder="Complaint title (min 3 chars)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={inputCls + ' mt-0 md:col-span-2'}
            rows={2}
            placeholder="What exactly happened? (min 10 chars)"
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
                  const created = await createStaffComplaint({
                    customerId,
                    category,
                    severity,
                    title: title.trim(),
                    description: description.trim(),
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
            Log complaint
          </button>
        </div>
        {options.notes.length ? (
          <p className="mt-2 text-[11px] text-[#8a8886]">{options.notes[0]}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={inputCls + ' mt-0 w-auto'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {(options.statuses.length
            ? options.statuses
            : ['OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED', 'CANCELLED']
          ).map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8886]" />
          <input
            className={inputCls + ' mt-0 w-64 pl-7'}
            placeholder="Search ref, title, customer"
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
        emptyMessage="No complaints match this filter"
        columns={[
          { key: 'referenceNumber', label: 'Ref' },
          {
            key: 'customerCode',
            label: 'Customer',
            render: (r) =>
              r.customerCode
                ? `${r.customerCode}${r.customerName ? ` · ${r.customerName}` : ''}`
                : '—',
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
            key: 'severity',
            label: 'Severity',
            render: (r) => <SeverityChip severity={r.severity} />,
          },
          {
            key: 'createdAt',
            label: 'Logged',
            render: (r) => new Date(r.createdAt).toLocaleDateString('en-GB'),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
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
                  transitions(r).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="text-xs font-medium text-[#0067b8] hover:underline disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void advance(r, s)}
                    >
                      {label(s)}
                    </button>
                  ))
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
              <SeverityChip severity={detail.severity} />
              <span className="rounded-full bg-[#f3f2f1] px-2 py-0.5 text-[11px] font-medium text-[#323130]">
                {label(detail.category)}
              </span>
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
              <Field label="Last update">{when(detail.updatedAt)}</Field>
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
                  Separation of duty: the officer who logged this complaint cannot
                  acknowledge, resolve, or close it.
                </p>
              ) : (
                transitions(detail).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={
                      s === 'CLOSED' ? btnSecondary : btnPrimary
                    }
                    disabled={busy}
                    onClick={() => void advance(detail, s)}
                  >
                    {label(s)}
                  </button>
                ))
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
            placeholder="What was done to resolve this complaint?"
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
                  const updated = await updateStaffComplaint(closeRow.id, {
                    status: 'CLOSED',
                    resolutionNotes: notes.trim(),
                  });
                  if (detail?.id === updated.id) setDetail(updated);
                  setCloseRow(null);
                  setNotice(`${updated.referenceNumber} closed.`);
                  await load();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'Failed to close complaint',
                  );
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Close complaint
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
