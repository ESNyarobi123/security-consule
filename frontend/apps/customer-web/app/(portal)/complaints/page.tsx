'use client';

import {
  cancelCustomerComplaint,
  createCustomerComplaint,
  getCustomerPortalSites,
  listCustomerComplaints,
  type ComplaintCategory,
  type ComplaintSeverity,
  type CreateComplaintBody,
  type CustomerComplaint,
  type PortalSite,
} from '@pssms/api-client';
import { AlertTriangle, Plus, RefreshCw, X } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalPanel,
  PortalStat,
  PortalToolbar,
  StatusPill,
  formatDate,
} from '../../_components/portal-ui';

const CATEGORIES: { id: ComplaintCategory; label: string }[] = [
  { id: 'SERVICE_QUALITY', label: 'Service quality' },
  { id: 'GUARD_CONDUCT', label: 'Guard conduct' },
  { id: 'BILLING', label: 'Billing dispute' },
  { id: 'ATTENDANCE', label: 'Attendance / coverage' },
  { id: 'SECURITY', label: 'Security concern' },
  { id: 'OTHER', label: 'Other' },
];

const SEVERITIES: { id: ComplaintSeverity; label: string }[] = [
  { id: 'LOW', label: 'Low' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'HIGH', label: 'High' },
  { id: 'CRITICAL', label: 'Critical' },
];

const inputCls =
  'w-full rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 text-sm text-[#1b1a19] outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/30';

export default function ComplaintsPage() {
  const [rows, setRows] = useState<CustomerComplaint[]>([]);
  const [sites, setSites] = useState<PortalSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    category: ComplaintCategory;
    severity: ComplaintSeverity;
    title: string;
    description: string;
    siteId: string;
    callbackPhone: string;
  }>({
    category: 'SERVICE_QUALITY',
    severity: 'MEDIUM',
    title: '',
    description: '',
    siteId: '',
    callbackPhone: '',
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, siteRows] = await Promise.all([
        listCustomerComplaints(),
        getCustomerPortalSites().catch(() => [] as PortalSite[]),
      ]);
      setRows(list);
      setSites(siteRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCount = useMemo(
    () =>
      rows.filter((r) =>
        ['OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW'].includes(r.status),
      ).length,
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.referenceNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateComplaintBody = {
        category: form.category,
        severity: form.severity,
        title: form.title.trim(),
        description: form.description.trim(),
        siteId: form.siteId || undefined,
        callbackPhone: form.callbackPhone.trim() || undefined,
      };
      await createCustomerComplaint(body);
      setShowForm(false);
      setForm({
        category: 'SERVICE_QUALITY',
        severity: 'MEDIUM',
        title: '',
        description: '',
        siteId: '',
        callbackPhone: '',
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancel(id: string) {
    setActingId(id);
    setError(null);
    try {
      await cancelCustomerComplaint(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PortalHero
        eyebrow="Module 6 · Complaints"
        title="Complaints"
        subtitle="File and track service complaints separately from coverage / access service requests."
        actions={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0078d4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#106ebe]"
          >
            <Plus className="h-4 w-4" />
            New complaint
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <PortalStat label="Total" value={loading ? '—' : rows.length} tone="sky" />
        <PortalStat label="Open" value={loading ? '—' : openCount} tone="amber" />
        <PortalStat
          label="Critical / high"
          value={
            loading
              ? '—'
              : rows.filter((r) =>
                  ['HIGH', 'CRITICAL'].includes(r.severity),
                ).length
          }
          tone="rose"
        />
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search ref, title, category…"
        trailing={
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e1dfdd] px-3 py-2 text-sm font-semibold text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <PortalPanel title="Complaint register">
        {loading ? (
          <p className="text-sm text-[#605e5c]">Loading…</p>
        ) : filtered.length === 0 ? (
          <PortalEmpty
            icon={<AlertTriangle className="h-5 w-5" />}
            title="No complaints"
            description="Use New complaint to raise a formal complaint with HIGHLINK."
          />
        ) : (
          <ul className="divide-y divide-[#edebe9]">
            {filtered.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs font-semibold text-[#605e5c]">
                      {r.referenceNumber}
                    </p>
                    <StatusPill status={r.status} />
                    <span className="rounded bg-[#f3f2f1] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#605e5c]">
                      {r.severity}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold text-[#1b1a19]">{r.title}</p>
                  <p className="mt-0.5 text-sm text-[#605e5c] line-clamp-2">
                    {r.description}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8a8886]">
                    {r.category.replace(/_/g, ' ')}
                    {r.siteName || r.siteCode
                      ? ` · ${r.siteName ?? r.siteCode}`
                      : ''}
                    {' · '}
                    {formatDate(r.createdAt)}
                  </p>
                </div>
                {r.status === 'OPEN' ? (
                  <button
                    type="button"
                    disabled={actingId === r.id}
                    onClick={() => void onCancel(r.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PortalPanel>

      <PortalDeferral note="Attachments, SMS status alerts, and SLA timers for complaints are deferred. Staff process complaints in Call Centre (visitors.manage or customers.manage)." />

      {showForm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1b1a19]">
                  File complaint
                </h2>
                <p className="text-sm text-[#605e5c]">
                  Call centre / accounts will acknowledge and investigate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="block text-sm font-medium text-[#323130]">
              Category
              <select
                className={inputCls}
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as ComplaintCategory,
                  }))
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#323130]">
              Severity
              <select
                className={inputCls}
                value={form.severity}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    severity: e.target.value as ComplaintSeverity,
                  }))
                }
              >
                {SEVERITIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#323130]">
              Title
              <input
                className={inputCls}
                required
                minLength={3}
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>

            <label className="block text-sm font-medium text-[#323130]">
              Description
              <textarea
                className={`${inputCls} min-h-[96px]`}
                required
                minLength={10}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </label>

            <label className="block text-sm font-medium text-[#323130]">
              Site (optional)
              <select
                className={inputCls}
                value={form.siteId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, siteId: e.target.value }))
                }
              >
                <option value="">—</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#323130]">
              Callback phone (optional)
              <input
                className={inputCls}
                value={form.callbackPhone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, callbackPhone: e.target.value }))
                }
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-[#e1dfdd] px-3 py-2 text-sm font-semibold text-[#323130]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0078d4] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${submitting ? 'animate-spin' : ''}`}
                />
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
