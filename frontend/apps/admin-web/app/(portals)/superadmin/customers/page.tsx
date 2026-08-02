'use client';

import {
  getCustomer,
  getDocumentDownloadUrl,
  inviteCustomerPortalUser,
  listCustomerPortalUsers,
  listCustomers,
  listDocuments,
  updateCustomer,
  uploadDocument,
  type Customer,
  type CustomerPortalUser,
  type DocumentObject,
  type InviteCustomerPortalUserResult,
  type UpdateCustomerBody,
} from '@pssms/api-client';
import { StatCard, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import {
  Building2,
  Copy,
  Download,
  FileText,
  KeyRound,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  UserRound,
  UserX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CustomerRoster,
  CustomersEmpty,
} from './_components/CustomerRoster';
import { CustomerRegisterWizard } from './_components/CustomerRegisterWizard';

type StatusFilter = 'all' | 'active' | 'prospect' | 'inactive';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'prospect', label: 'Prospect' },
  { id: 'inactive', label: 'Suspended' },
];

function formatApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    /* plain text */
  }
  return raw;
}

function opt(value: string): string | null {
  const t = value.trim();
  return t.length ? t : null;
}

export default function CustomersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const [detail, setDetail] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    tin: '',
    email: '',
    phone: '',
    address: '',
    contactPerson: '',
    contactDesignation: '',
    city: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [portalUsers, setPortalUsers] = useState<CustomerPortalUser[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    phone: '',
  });
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] =
    useState<InviteCustomerPortalUserResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [customerDocs, setCustomerDocs] = useState<DocumentObject[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docsUploading, setDocsUploading] = useState(false);
  const [docsFile, setDocsFile] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCustomers());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === 'ACTIVE' || (r.isActive && r.status !== 'PROSPECT')).length;
    const prospect = rows.filter((r) => r.status === 'PROSPECT').length;
    const withSites = rows.filter((r) => (r.siteCount ?? 0) > 0).length;
    const withContracts = rows.filter((r) => (r.contractCount ?? 0) > 0).length;
    return { total, active, prospect, withSites, withContracts };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'active' && r.status !== 'ACTIVE' && !(r.isActive && !r.status))
        return false;
      if (statusFilter === 'prospect' && r.status !== 'PROSPECT') return false;
      if (
        statusFilter === 'inactive' &&
        r.status !== 'SUSPENDED' &&
        r.status !== 'TERMINATED' &&
        r.isActive
      )
        return false;
      if (!q) return true;
      const hay = [
        r.code,
        r.name,
        r.tradingName,
        r.tin,
        r.email,
        r.billingEmail,
        r.phone,
        r.address,
        r.contactPerson,
        r.category,
        r.industry,
        ...(r.serviceTypes ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, statusFilter]);

  async function loadPortalUsers(customerId: string) {
    setPortalLoading(true);
    try {
      setPortalUsers(await listCustomerPortalUsers(customerId));
    } catch {
      setPortalUsers([]);
    } finally {
      setPortalLoading(false);
    }
  }

  async function loadCustomerDocs(customerId: string) {
    setDocsLoading(true);
    setDocsError(null);
    try {
      setCustomerDocs(
        await listDocuments({
          resourceType: 'Customer',
          resourceId: customerId,
        }),
      );
    } catch (err) {
      setCustomerDocs([]);
      setDocsError(formatApiError(err));
    } finally {
      setDocsLoading(false);
    }
  }

  async function openDetail(row: Customer) {
    setDetail(row);
    setEditMode(false);
    setEditError(null);
    setInviteOpen(false);
    setInviteResult(null);
    setInviteError(null);
    setDocsFile(null);
    setDocsError(null);
    setDetailLoading(true);
    void loadPortalUsers(row.id);
    void loadCustomerDocs(row.id);
    try {
      const full = await getCustomer(row.id);
      setDetail(full);
      setEditForm({
        name: full.name,
        tin: full.tin ?? '',
        email: full.billingEmail ?? full.email ?? '',
        phone: full.phone ?? '',
        address: full.address ?? '',
        contactPerson: full.contactPerson ?? '',
        contactDesignation: full.contactDesignation ?? '',
        city: full.city ?? '',
      });
      setInviteForm({
        email: full.billingEmail ?? full.email ?? '',
        fullName: full.contactPerson
          ? `${full.contactPerson} (Portal)`
          : `${full.name} Portal`,
        phone: full.phone ?? '',
      });
    } catch (err) {
      setEditError(formatApiError(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function onUploadCustomerDoc(e: FormEvent) {
    e.preventDefault();
    if (!detail || !docsFile) {
      setDocsError('Choose a file (pdf, png, jpeg, or webp — max 10MB)');
      return;
    }
    setDocsUploading(true);
    setDocsError(null);
    try {
      await uploadDocument({
        file: docsFile,
        resourceType: 'Customer',
        resourceId: detail.id,
      });
      setDocsFile(null);
      await loadCustomerDocs(detail.id);
    } catch (err) {
      setDocsError(formatApiError(err));
    } finally {
      setDocsUploading(false);
    }
  }

  async function onDownloadCustomerDoc(doc: DocumentObject) {
    setDocsError(null);
    try {
      const { url } = await getDocumentDownloadUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDocsError(formatApiError(err));
    }
  }

  async function onInvitePortal(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setInviteError(null);
    setInviteSaving(true);
    try {
      const res = await inviteCustomerPortalUser(detail.id, {
        email: inviteForm.email.trim(),
        fullName: inviteForm.fullName.trim(),
        phone: opt(inviteForm.phone) ?? undefined,
      });
      setInviteResult(res);
      setInviteOpen(false);
      await loadPortalUsers(detail.id);
    } catch (err) {
      setInviteError(formatApiError(err));
    } finally {
      setInviteSaving(false);
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setEditError(null);
    setSaving(true);
    const body: UpdateCustomerBody = {
      name: editForm.name.trim(),
      tin: opt(editForm.tin),
      billingEmail: opt(editForm.email),
      email: opt(editForm.email),
      phone: opt(editForm.phone),
      address: opt(editForm.address),
      contactPerson: opt(editForm.contactPerson),
      contactDesignation: opt(editForm.contactDesignation),
      city: opt(editForm.city),
    };
    try {
      const updated = await updateCustomer(detail.id, body);
      setDetail(updated);
      setEditMode(false);
      await refresh();
    } catch (err) {
      setEditError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!detail) return;
    setSaving(true);
    setEditError(null);
    try {
      const suspend = detail.status === 'ACTIVE' || detail.isActive;
      const updated = await updateCustomer(detail.id, {
        status: suspend ? 'SUSPENDED' : 'ACTIVE',
        isActive: !suspend,
      });
      setDetail(updated);
      await refresh();
    } catch (err) {
      setEditError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1f3a] via-[#0e2f52] to-[#0d9488] px-6 py-7 text-white shadow-lg">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #fff 0, transparent 45%), radial-gradient(circle at 80% 0%, #5eead4 0, transparent 40%)',
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-100/90">
              Super Admin · Module 6
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Customer Management
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-200/90">
              Full commercial registration (company → contacts → services →
              billing). Sites and contracts follow after create.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#0b1f3a] hover:bg-teal-50"
            >
              <Plus className="h-4 w-4" />
              New customer
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total customers"
          value={stats.total}
          hint="All registered accounts"
          accent="blue"
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={stats.active}
          hint="Live commercial accounts"
          accent="emerald"
          icon={<UserCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Prospects"
          value={stats.prospect}
          hint="Draft / pipeline"
          accent="amber"
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          label="With sites"
          value={stats.withSites}
          hint="Linked enterprise sites"
          accent="sky"
          icon={<MapPin className="h-5 w-5" />}
        />
      </div>

      <CustomerRoster
        rows={filtered}
        loading={loading}
        onOpen={(row) => void openDetail(row)}
        empty={
          <CustomersEmpty onCreate={() => setCreateOpen(true)} />
        }
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a19f9d]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search code, name, TIN, services…"
                className="w-full rounded-lg border border-[#e1dfdd] bg-white py-2 pl-9 pr-3 text-sm text-[#323130] outline-none ring-[#0078d4] focus:ring-2"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={
                    statusFilter === f.id
                      ? 'rounded-full bg-[#0078d4] px-3 py-1 text-xs font-semibold text-white'
                      : 'rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f2f1]'
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <p className="text-xs text-[#605e5c]">
        After register: add sites under{' '}
        <Link href="/branch/sites" className="font-semibold text-[#0078d4] hover:underline">
          Branch → Sites
        </Link>
        , then a{' '}
        <Link
          href="/superadmin/contracts"
          className="font-semibold text-[#0078d4] hover:underline"
        >
          contract
        </Link>
        . Portal invite and documents are on the customer drawer.
      </p>

      {createOpen ? (
        <CustomerRegisterWizard
          onClose={() => setCreateOpen(false)}
          onCreated={(customer, goContract) => {
            void refresh();
            if (goContract) {
              setCreateOpen(false);
              router.push(`/superadmin/contracts?customerId=${customer.id}`);
            }
          }}
        />
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close drawer"
            onClick={() => setDetail(null)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#edebe9] px-5 py-4">
              <div>
                <p className="font-mono text-[11px] text-[#605e5c]">{detail.code}</p>
                <h2 className="text-lg font-bold text-[#1b1a19]">{detail.name}</h2>
                <p className="mt-0.5 text-xs text-[#605e5c]">
                  {detail.status ?? (detail.isActive ? 'ACTIVE' : 'SUSPENDED')}
                  {detail.category ? ` · ${detail.category}` : ''}
                  {detail.ranking ? ` · ${detail.ranking}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg p-1.5 text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <p className="text-sm text-[#605e5c]">Loading…</p>
              ) : editMode ? (
                <form onSubmit={onSaveEdit} className="space-y-3">
                  {(
                    [
                      ['name', 'Company name'],
                      ['tin', 'TIN'],
                      ['contactPerson', 'Contact person'],
                      ['contactDesignation', 'Designation'],
                      ['email', 'Billing email'],
                      ['phone', 'Phone'],
                      ['city', 'City'],
                      ['address', 'Address'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="block text-sm font-medium text-[#323130]"
                    >
                      {label}
                      {key === 'address' ? (
                        <textarea
                          value={editForm[key]}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, [key]: e.target.value }))
                          }
                          className={`${inputCls} min-h-[64px] resize-y`}
                          rows={2}
                        />
                      ) : (
                        <input
                          value={editForm[key]}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, [key]: e.target.value }))
                          }
                          className={inputCls}
                          required={key === 'name'}
                        />
                      )}
                    </label>
                  ))}
                  {editError ? (
                    <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {editError}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className={btnSecondary}
                    >
                      Cancel
                    </button>
                    <button type="submit" className={btnPrimary} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5">
                  <dl className="grid gap-3 text-sm">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Industry
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {detail.industry ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        TIN / VRN
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {detail.tin ?? '—'}
                        {detail.vrn ? ` · ${detail.vrn}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Contact
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-[#323130]">
                        <UserRound className="h-3.5 w-3.5 text-[#a19f9d]" />
                        {detail.contactPerson ?? '—'}
                        {detail.contactDesignation
                          ? ` — ${detail.contactDesignation}`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Billing email
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {detail.billingEmail ?? detail.email ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Address
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {[detail.address, detail.city, detail.region, detail.country]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Services
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {(detail.serviceTypes ?? []).join(', ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Commercial
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {[detail.paymentTerms, detail.invoiceFrequency, detail.currency, detail.slaLevel]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                      Linked sites ({detail.sites?.length ?? detail.siteCount ?? 0})
                    </h3>
                    {detail.sites && detail.sites.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {detail.sites.map((s) => (
                          <li
                            key={s.id}
                            className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm"
                          >
                            <p className="font-semibold text-[#323130]">{s.name}</p>
                            <p className="font-mono text-[11px] text-[#605e5c]">
                              {s.code}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-[#605e5c]">
                        No sites yet —{' '}
                        <Link
                          href="/branch/sites"
                          className="font-semibold text-[#0078d4] hover:underline"
                        >
                          Branch → Sites
                        </Link>
                        .
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Portal users ({portalUsers.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setInviteOpen(true);
                          setInviteError(null);
                          setInviteResult(null);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Invite
                      </button>
                    </div>
                    {portalLoading ? (
                      <p className="mt-2 text-xs text-[#605e5c]">Loading…</p>
                    ) : portalUsers.length === 0 ? (
                      <p className="mt-2 text-xs text-[#605e5c]">
                        No portal logins yet — invite a host/admin for this
                        customer.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {portalUsers.map((u) => (
                          <li
                            key={u.id}
                            className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm"
                          >
                            <p className="font-semibold text-[#323130]">
                              {u.fullName}
                            </p>
                            <p className="text-xs text-[#605e5c]">{u.email}</p>
                            <p className="mt-0.5 text-[11px] text-[#8a8886]">
                              {u.isActive ? 'Active' : 'Suspended'}
                              {u.roles?.length
                                ? ` · ${u.roles.join(', ')}`
                                : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {inviteResult ? (
                      <div className="mt-3 rounded-lg border border-[#107c10]/30 bg-[#dff6dd] px-3 py-2 text-sm text-[#0b5a0b]">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <KeyRound className="h-4 w-4" />
                          Invite created — copy password once
                        </p>
                        <p className="mt-1 text-xs">
                          {inviteResult.email}
                          {inviteResult.notificationQueued
                            ? ' · email queued'
                            : ' · email not queued (copy password)'}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 rounded bg-white/80 px-2 py-1 font-mono text-xs">
                            {inviteResult.temporaryPassword}
                          </code>
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  inviteResult.temporaryPassword,
                                );
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1500);
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            <Copy className="mr-1 inline h-3.5 w-3.5" />
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                      Documents ({customerDocs.length})
                    </h3>
                    <p className="mt-1 text-[11px] text-[#8a8886]">
                      Shared with the customer portal (pdf / png / jpeg / webp ·
                      max 10MB). Requires documents.manage.
                    </p>
                    {docsLoading ? (
                      <p className="mt-2 text-xs text-[#605e5c]">Loading…</p>
                    ) : customerDocs.length === 0 ? (
                      <p className="mt-2 text-xs text-[#605e5c]">
                        No attachments yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {customerDocs.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#323130]">
                                {d.fileName}
                              </p>
                              <p className="text-[11px] text-[#8a8886]">
                                {(d.sizeBytes / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void onDownloadCustomerDoc(d)}
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Open
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form
                      onSubmit={onUploadCustomerDoc}
                      className="mt-3 space-y-2"
                    >
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                        onChange={(e) =>
                          setDocsFile(e.target.files?.[0] ?? null)
                        }
                        className="block w-full text-xs text-[#605e5c]"
                      />
                      <button
                        type="submit"
                        disabled={docsUploading || !docsFile}
                        className={btnSecondary}
                      >
                        <FileText className="mr-1 inline h-3.5 w-3.5" />
                        {docsUploading ? 'Uploading…' : 'Upload file'}
                      </button>
                    </form>
                    {docsError ? (
                      <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        {docsError}
                      </p>
                    ) : null}
                  </div>

                  {editError ? (
                    <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {editError}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {!editMode && !detailLoading ? (
              <div className="flex flex-wrap gap-2 border-t border-[#edebe9] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className={btnPrimary}
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInviteOpen(true);
                    setInviteError(null);
                  }}
                  className={btnSecondary}
                >
                  <UserPlus className="mr-1 inline h-4 w-4" />
                  Invite portal
                </button>
                <button
                  type="button"
                  onClick={() => void toggleActive()}
                  disabled={saving}
                  className={btnSecondary}
                >
                  {detail.status === 'SUSPENDED' || !detail.isActive ? (
                    <>
                      <UserCheck className="mr-1 inline h-4 w-4" />
                      Activate
                    </>
                  ) : (
                    <>
                      <UserX className="mr-1 inline h-4 w-4" />
                      Suspend
                    </>
                  )}
                </button>
                <Link
                  href={`/superadmin/contracts?customerId=${detail.id}`}
                  className={btnSecondary}
                >
                  Contract
                </Link>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {inviteOpen && detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1b1a19]">
                  Invite portal user
                </h2>
                <p className="mt-1 text-sm text-[#605e5c]">
                  {detail.name} · CUSTOMER_PORTAL bound to this customer
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg p-1.5 text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onInvitePortal} className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-[#323130]">
                Full name
                <input
                  required
                  value={inviteForm.fullName}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Email
                <input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Phone (optional)
                <input
                  value={inviteForm.phone}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              {inviteError ? (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {inviteError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setInviteOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={inviteSaving}
                >
                  {inviteSaving ? 'Inviting…' : 'Create invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
