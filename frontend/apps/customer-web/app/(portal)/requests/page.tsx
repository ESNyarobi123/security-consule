'use client';

import {
  cancelCustomerServiceRequest,
  createCustomerServiceRequest,
  getCustomerPortalSites,
  listCustomerServiceRequests,
  type CreateServiceRequestBody,
  type CustomerServiceRequest,
  type PortalSite,
  type ServiceRequestCategory,
  type ServiceRequestUrgency,
} from '@pssms/api-client';
import {
  ClipboardList,
  Headphones,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
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

const CATEGORIES: { id: ServiceRequestCategory; label: string }[] = [
  { id: 'EXTRA_GUARDS', label: 'Extra guards' },
  { id: 'COVERAGE', label: 'Coverage gap' },
  { id: 'ACCESS', label: 'Access / staff cards' },
  { id: 'VISITOR', label: 'Visitor exception' },
  { id: 'BILLING', label: 'Billing question' },
  { id: 'OTHER', label: 'Other' },
];

const URGENCIES: { id: ServiceRequestUrgency; label: string }[] = [
  { id: 'SAME_DAY', label: 'Same day' },
  { id: 'THIS_WEEK', label: 'This week' },
  { id: 'PLANNING', label: 'Planning' },
];

const inputCls =
  'w-full rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 text-sm text-[#1b1a19] outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/30';

const CHANNELS = [
  {
    title: 'Account manager',
    detail: 'Contract changes, new sites',
    href: 'mailto:accounts@highlink.co.tz',
    label: 'accounts@highlink.co.tz',
    icon: Mail,
  },
  {
    title: 'Operations desk',
    detail: 'Coverage & supervisor escalation',
    href: 'tel:+255700000000',
    label: '+255 700 000 000',
    icon: Phone,
  },
  {
    title: 'Call centre',
    detail: '24/7 urgent security events',
    href: 'tel:+255700000001',
    label: '+255 700 000 001',
    icon: Headphones,
  },
];

export default function RequestsPage() {
  const [rows, setRows] = useState<CustomerServiceRequest[]>([]);
  const [sites, setSites] = useState<PortalSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    category: ServiceRequestCategory;
    urgency: ServiceRequestUrgency;
    title: string;
    description: string;
    siteId: string;
    callbackPhone: string;
  }>({
    category: 'COVERAGE',
    urgency: 'THIS_WEEK',
    title: '',
    description: '',
    siteId: '',
    callbackPhone: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tickets, siteRows] = await Promise.all([
        listCustomerServiceRequests(),
        getCustomerPortalSites().catch(() => [] as PortalSite[]),
      ]);
      setRows(tickets);
      setSites(siteRows);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load service requests',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCount = useMemo(
    () =>
      rows.filter((r) =>
        ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(r.status),
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
        r.category.toLowerCase().includes(q) ||
        (r.siteCode ?? '').toLowerCase().includes(q) ||
        (r.siteName ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateServiceRequestBody = {
        category: form.category,
        urgency: form.urgency,
        title: form.title.trim(),
        description: form.description.trim(),
      };
      if (form.siteId) body.siteId = form.siteId;
      if (form.callbackPhone.trim()) body.callbackPhone = form.callbackPhone.trim();
      await createCustomerServiceRequest(body);
      setShowForm(false);
      setForm({
        category: 'COVERAGE',
        urgency: 'THIS_WEEK',
        title: '',
        description: '',
        siteId: '',
        callbackPhone: '',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancel(id: string) {
    setActingId(id);
    setError(null);
    try {
      await cancelCustomerServiceRequest(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Support · Portal 35.8"
        title="Service requests"
        subtitle="Raise and track tickets with HIGHLINK — scoped to your organisation. Phone channels remain available for emergencies."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-400"
            >
              <Plus className="h-4 w-4" />
              New request
            </button>
          </div>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <PortalStat label="Tickets" value={loading ? '—' : rows.length} tone="sky" />
        <PortalStat
          label="Open / in progress"
          value={loading ? '—' : openCount}
          tone="amber"
        />
        <PortalStat label="Channels" value={CHANNELS.length} tone="teal" />
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search reference, title, site…"
      />

      {loading && rows.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#edebe9]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PortalEmpty
          icon={<ClipboardList className="h-5 w-5" />}
          title="No service requests yet"
          description="Create a ticket for coverage, billing, visitors, or access — HIGHLINK Call Centre will process it."
        />
      ) : (
        <ul className="mb-6 space-y-3">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs font-semibold text-[#0078d4]">
                      {r.referenceNumber}
                    </p>
                    <StatusPill status={r.status} />
                    <span className="rounded-full bg-[#f3f2f1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
                      {r.urgency.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-base font-semibold text-[#1b1a19]">
                    {r.title}
                  </p>
                  <p className="mt-1 text-sm text-[#605e5c] line-clamp-2">
                    {r.description}
                  </p>
                  <p className="mt-2 text-xs text-[#605e5c]">
                    {CATEGORIES.find((c) => c.id === r.category)?.label ??
                      r.category}
                    {r.siteCode
                      ? ` · ${r.siteCode}${r.siteName ? ` — ${r.siteName}` : ''}`
                      : ''}
                    {' · '}
                    {formatDate(r.createdAt, true)}
                  </p>
                  {r.resolutionNotes ? (
                    <p className="mt-2 rounded-lg bg-[#faf9f8] px-3 py-2 text-xs text-[#323130]">
                      Notes: {r.resolutionNotes}
                    </p>
                  ) : null}
                </div>
                {r.status === 'OPEN' ? (
                  <button
                    type="button"
                    disabled={actingId === r.id}
                    onClick={() => void onCancel(r.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PortalPanel title="Emergency / voice channels">
            <ul className="grid gap-3 sm:grid-cols-3">
              {CHANNELS.map((c) => (
                <li
                  key={c.title}
                  className="rounded-xl border border-[#e1dfdd] bg-[#faf9f8] px-3 py-3"
                >
                  <c.icon className="mb-2 h-4 w-4 text-[#0078d4]" />
                  <p className="text-sm font-semibold">{c.title}</p>
                  <p className="text-xs text-[#605e5c]">{c.detail}</p>
                  <a
                    href={c.href}
                    className="mt-1 inline-block text-xs font-semibold text-[#0078d4] hover:underline"
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </PortalPanel>
        </div>
        <PortalDeferral note="Attachments on tickets, SLA timers, and SMS/WhatsApp status alerts are deferred. Staff process tickets in Call Centre (visitors.manage or customers.manage)." />
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1b1a19]">New service request</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#605e5c]">
                Category
                <select
                  className={`${inputCls} mt-1`}
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      category: e.target.value as ServiceRequestCategory,
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
              <label className="block text-xs font-semibold text-[#605e5c]">
                Urgency
                <select
                  className={`${inputCls} mt-1`}
                  value={form.urgency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      urgency: e.target.value as ServiceRequestUrgency,
                    }))
                  }
                >
                  {URGENCIES.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-[#605e5c]">
                Site (optional)
                <select
                  className={`${inputCls} mt-1`}
                  value={form.siteId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, siteId: e.target.value }))
                  }
                >
                  <option value="">— Any / not site-specific —</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-[#605e5c]">
                Title
                <input
                  required
                  minLength={3}
                  className={`${inputCls} mt-1`}
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Extra night guards this weekend"
                />
              </label>
              <label className="block text-xs font-semibold text-[#605e5c]">
                Description
                <textarea
                  required
                  minLength={10}
                  rows={4}
                  className={`${inputCls} mt-1`}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Site, what you need, on-site contact…"
                />
              </label>
              <label className="block text-xs font-semibold text-[#605e5c]">
                Callback phone (optional)
                <input
                  className={`${inputCls} mt-1`}
                  value={form.callbackPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, callbackPhone: e.target.value }))
                  }
                  placeholder="+255…"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-[#605e5c] ring-1 ring-[#e1dfdd]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#0078d4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#106ebe] disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit ticket'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
