'use client';

import {
  approveContract,
  CONTRACT_INVOICE_FREQUENCIES,
  CONTRACT_KINDS,
  CONTRACT_SLA_LEVELS,
  createContract,
  getContractCommercialAlerts,
  getDocumentDownloadUrl,
  listContracts,
  listCustomers,
  listDocuments,
  listSites,
  rejectContract,
  scanExpiringContracts,
  submitContract,
  updateContractStatus,
  uploadDocument,
  type Contract,
  type ContractCommercialAlerts,
  type Customer,
  type DocumentObject,
  type Site,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import {
  DataTable,
  Modal,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  AlertTriangle,
  CheckCircle2,
  FileClock,
  FileText,
  Paperclip,
  Plus,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

/** B3 contract-approval matrix step count (Legal → GM → CEO → CMD). */
const CONTRACT_APPROVAL_STEPS = 4;

function approvalRoleLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  const map: Record<string, string> = {
    LEGAL: 'Legal',
    GENERAL_MANAGER: 'GM',
    CEO: 'CEO',
    CMD: 'CMD',
  };
  return map[role] ?? role.replace(/_/g, ' ');
}

function approvalStepBadge(c: Contract): string | null {
  if (c.status !== 'PENDING_APPROVAL') return null;
  const order = c.approvalCurrentStepOrder;
  const name = c.approvalCurrentStepName;
  if (order == null && !name) return null;
  const stepPart =
    order != null ? `Step ${order}/${CONTRACT_APPROVAL_STEPS}` : 'Pending';
  return name ? `${stepPart} · ${name}` : stepPart;
}

function canActCurrentStep(
  c: Contract,
  roles: string[] | undefined,
): boolean {
  if (!roles?.length) return false;
  if (roles.includes('SUPER_ADMIN')) return true;
  const required = c.approvalRequiredRole;
  if (!required || required === '*') return true;
  return roles.includes(required);
}

const SERVICE_TYPES = [
  'SECURITY_GUARD',
  'CCTV_MONITORING',
  'VISITOR_MANAGEMENT',
  'ACCESS_CONTROL',
  'PARKING',
  'ALARM_RESPONSE',
  'RECRUITMENT',
  'CUSTOMER_PAYROLL',
  'TECHNICAL',
] as const;

const CURRENCIES = ['TZS', 'USD', 'EUR', 'KES'] as const;

const PAYMENT_TERMS = [
  'NET_15',
  'NET_30',
  'NET_45',
  'NET_60',
  'PREPAID',
  'ON_INVOICE',
] as const;

const fmtMoney = (n: number, currency = 'TZS') =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isExpiringSoon(c: Contract) {
  const s = c.status.toUpperCase();
  if (s.includes('EXPIR')) return true;
  if (!c.endDate || !s.includes('ACTIVE')) return false;
  const end = new Date(c.endDate).getTime();
  const in90 = Date.now() + 90 * 24 * 60 * 60 * 1000;
  return !Number.isNaN(end) && end <= in90 && end >= Date.now();
}

function serviceLabels(c: Contract): string[] {
  if (c.serviceTypes && c.serviceTypes.length > 0) return c.serviceTypes;
  return c.serviceType ? [c.serviceType] : [];
}

type ContractForm = {
  customerId: string;
  contractNumber: string;
  title: string;
  contractKind: string;
  serviceTypes: string[];
  currency: string;
  paymentTerms: string;
  invoiceFrequency: string;
  vatApplicable: boolean;
  startDate: string;
  endDate: string;
  renewalDate: string;
  noticePeriodDays: string;
  monthlyFee: string;
  guardCount: string;
  slaLevel: string;
  slaTerms: string;
  siteIds: string[];
};

const emptyForm: ContractForm = {
  customerId: '',
  contractNumber: '',
  title: '',
  contractKind: 'NEW',
  serviceTypes: ['SECURITY_GUARD'],
  currency: 'TZS',
  paymentTerms: 'NET_30',
  invoiceFrequency: 'MONTHLY',
  vatApplicable: true,
  startDate: '',
  endDate: '',
  renewalDate: '',
  noticePeriodDays: '30',
  monthlyFee: '',
  guardCount: '',
  slaLevel: 'STANDARD',
  slaTerms: '',
  siteIds: [],
};

export default function ContractsPage() {
  const sessionUser = useMemo(() => getSessionUser(), []);
  const [rows, setRows] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'DRAFT' | 'EXPIRING'
  >('ALL');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ContractForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [docsFor, setDocsFor] = useState<Contract | null>(null);
  const [docs, setDocs] = useState<DocumentObject[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docsFile, setDocsFile] = useState<File | null>(null);
  const [docsUploading, setDocsUploading] = useState(false);
  const [alerts, setAlerts] = useState<ContractCommercialAlerts | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contracts, custs, commercial, allSites] = await Promise.all([
        listContracts(),
        listCustomers(),
        getContractCommercialAlerts().catch(() => null),
        listSites().catch(() => [] as Site[]),
      ]);
      setRows(contracts);
      setCustomers(custs);
      setAlerts(commercial);
      setSites(allSites);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === 'ACTIVE');
    const drafts = rows.filter((r) => r.status === 'DRAFT');
    const expiring = rows.filter(isExpiringSoon);
    const totalMonthly = rows.reduce(
      (sum, r) => sum + Number(r.monthlyFee || 0),
      0,
    );
    const activeMonthly = active.reduce(
      (sum, r) => sum + Number(r.monthlyFee || 0),
      0,
    );
    const currency = rows[0]?.currency ?? 'TZS';
    return {
      total: rows.length,
      activeCount: active.length,
      draftCount: drafts.length,
      expiringCount: expiring.length,
      totalMonthly,
      activeMonthly,
      currency,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return rows;
    if (statusFilter === 'EXPIRING') return rows.filter(isExpiringSoon);
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const customerName = useCallback(
    (id: string) => customers.find((c) => c.id === id)?.name ?? '—',
    [customers],
  );

  const customerSites = useMemo(
    () =>
      form.customerId
        ? sites.filter((s) => s.customerId === form.customerId)
        : [],
    [sites, form.customerId],
  );

  function openCreate() {
    const n = Date.now().toString().slice(-6);
    const firstCustomerId = customers[0]?.id ?? '';
    const defaultSites = firstCustomerId
      ? sites
          .filter((s) => s.customerId === firstCustomerId)
          .slice(0, 1)
          .map((s) => s.id)
      : [];
    setForm({
      customerId: firstCustomerId,
      contractNumber: `CTR-${n}`,
      title: 'Manned guarding services',
      contractKind: 'NEW',
      serviceTypes: ['SECURITY_GUARD'],
      currency: 'TZS',
      paymentTerms: 'NET_30',
      invoiceFrequency: 'MONTHLY',
      vatApplicable: true,
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      renewalDate: '2027-05-02',
      noticePeriodDays: '30',
      monthlyFee: '4500000',
      guardCount: '12',
      slaLevel: 'STANDARD',
      slaTerms:
        'Response within 30 minutes for critical site alerts; monthly SLA report to customer.',
      siteIds: defaultSites,
    });
    setError(null);
    setOpen(true);
  }

  function toggleServiceType(code: string) {
    setForm((f) => {
      const has = f.serviceTypes.includes(code);
      const next = has
        ? f.serviceTypes.filter((s) => s !== code)
        : [...f.serviceTypes, code];
      return { ...f, serviceTypes: next };
    });
  }

  function toggleSite(siteId: string) {
    setForm((f) => {
      const has = f.siteIds.includes(siteId);
      return {
        ...f,
        siteIds: has
          ? f.siteIds.filter((id) => id !== siteId)
          : [...f.siteIds, siteId],
      };
    });
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.customerId) {
      setError('Select a customer first.');
      return;
    }
    if (form.serviceTypes.length === 0) {
      setError('Select at least one service type.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const guard = form.guardCount.trim()
        ? Number(form.guardCount)
        : undefined;
      const notice = form.noticePeriodDays.trim()
        ? Number(form.noticePeriodDays)
        : undefined;
      await createContract({
        customerId: form.customerId,
        contractNumber: form.contractNumber,
        title: form.title,
        contractKind: form.contractKind as (typeof CONTRACT_KINDS)[number],
        serviceTypes: form.serviceTypes,
        currency: form.currency,
        paymentTerms: form.paymentTerms,
        invoiceFrequency:
          form.invoiceFrequency as (typeof CONTRACT_INVOICE_FREQUENCIES)[number],
        vatApplicable: form.vatApplicable,
        startDate: form.startDate,
        endDate: form.endDate,
        monthlyFee: Number(form.monthlyFee),
        siteIds: form.siteIds,
        slaLevel: form.slaLevel as (typeof CONTRACT_SLA_LEVELS)[number],
        ...(notice != null && !Number.isNaN(notice)
          ? { noticePeriodDays: notice }
          : {}),
        ...(form.renewalDate.trim()
          ? { renewalDate: form.renewalDate.trim() }
          : {}),
        ...(guard != null && !Number.isNaN(guard) ? { guardCount: guard } : {}),
        ...(form.slaTerms.trim() ? { slaTerms: form.slaTerms.trim() } : {}),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setError(null);
    try {
      await updateContractStatus(id, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    }
  }

  async function onSubmitApproval(id: string) {
    setError(null);
    try {
      await submitContract(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    }
  }

  async function onApprove(id: string) {
    setError(null);
    try {
      await approveContract(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  }

  async function onReject(id: string) {
    const reason = window.prompt('Rejection reason (optional)') ?? undefined;
    setError(null);
    try {
      await rejectContract(id, reason?.trim() ? { reason: reason.trim() } : {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    }
  }

  async function onScanExpiring() {
    setScanning(true);
    setScanMsg(null);
    setError(null);
    try {
      const res = await scanExpiringContracts(90);
      setScanMsg(
        `Scan done — marked ${res.markedExpiring} EXPIRING, queued ${res.notificationsQueued} email(s).`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Expiry scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function openDocs(c: Contract) {
    setDocsFor(c);
    setDocsFile(null);
    setDocsError(null);
    setDocsLoading(true);
    try {
      setDocs(
        await listDocuments({
          resourceType: 'Contract',
          resourceId: c.id,
        }),
      );
    } catch (err) {
      setDocs([]);
      setDocsError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setDocsLoading(false);
    }
  }

  async function onUploadDoc(e: FormEvent) {
    e.preventDefault();
    if (!docsFor || !docsFile) {
      setDocsError('Choose a file (pdf, png, jpeg, or webp — max 10MB)');
      return;
    }
    setDocsUploading(true);
    setDocsError(null);
    try {
      await uploadDocument({
        file: docsFile,
        resourceType: 'Contract',
        resourceId: docsFor.id,
      });
      setDocsFile(null);
      setDocs(
        await listDocuments({
          resourceType: 'Contract',
          resourceId: docsFor.id,
        }),
      );
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setDocsUploading(false);
    }
  }

  async function onDownloadDoc(doc: DocumentObject) {
    setDocsError(null);
    try {
      const { url } = await getDocumentDownloadUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  return (
    <>
      <PageHeader
        title="Contracts"
        description="Commercial agreements — dates, fees, guards, SLA, and signed documents"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onScanExpiring()}
              className={btnSecondary}
              disabled={scanning}
            >
              <RefreshCw
                className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`}
              />
              {scanning ? 'Scanning…' : 'Scan expiring'}
            </button>
            <button type="button" onClick={openCreate} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              New contract
            </button>
          </div>
        }
      />

      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {scanMsg ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {scanMsg}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total contracts"
          value={stats.total}
          hint={`${stats.activeCount} active · ${stats.draftCount} draft`}
          icon={<FileText className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Active"
          value={stats.activeCount}
          hint={
            stats.total
              ? `${Math.round((stats.activeCount / stats.total) * 100)}% of portfolio`
              : 'No contracts yet'
          }
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Expiring ≤90d"
          value={stats.expiringCount}
          hint="ACTIVE nearing end or EXPIRING"
          icon={<FileClock className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Drafts"
          value={stats.draftCount}
          hint="Awaiting activation"
          icon={<FileClock className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="Monthly value"
          value={fmtMoney(stats.totalMonthly, stats.currency)}
          hint={`${fmtMoney(stats.activeMonthly, stats.currency)} active MRR`}
          icon={<Wallet className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ['ALL', 'All'],
            ['ACTIVE', 'Active'],
            ['DRAFT', 'Draft'],
            ['EXPIRING', 'Expiring'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatusFilter(id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              statusFilter === id
                ? 'bg-[#0078d4] text-white ring-[#0078d4]'
                : 'bg-white text-[#323130] ring-[#e1dfdd] hover:bg-[#f3f2f1]'
            }`}
          >
            {label}
            {id === 'EXPIRING' ? ` (${stats.expiringCount})` : ''}
          </button>
        ))}
      </div>

      {alerts &&
      (alerts.expiring.length > 0 || alerts.unpaidByCustomer.length > 0) ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Expiring / due ≤90d ({alerts.expiring.length})
            </div>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {alerts.expiring.slice(0, 8).map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-amber-100"
                >
                  <span className="font-mono text-xs text-[#0078d4]">
                    {c.contractNumber}
                  </span>
                  <span className="text-[#605e5c]">
                    ends{' '}
                    {c.endDate
                      ? new Date(c.endDate).toLocaleDateString('en-TZ')
                      : '—'}
                  </span>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-900">
              <Wallet className="h-4 w-4" />
              Open invoices by customer ({alerts.unpaidByCustomer.length})
            </div>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {alerts.unpaidByCustomer.slice(0, 8).map((u) => (
                <li
                  key={u.customerId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-rose-100"
                >
                  <span className="font-medium text-[#1b1a19]">
                    {u.customerCode} · {u.customerName}
                  </span>
                  <span className="text-xs text-[#605e5c]">
                    {u.openInvoiceCount} open
                    {u.hasExpiringContract ? ' · expiring contract' : ''}
                  </span>
                  <span className="font-semibold text-rose-700">
                    {fmtMoney(Number(u.openBalance), u.currency)}
                  </span>
                </li>
              ))}
              {alerts.unpaidByCustomer.length === 0 ? (
                <li className="text-[#605e5c]">No open invoice balances.</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <SectionTitle>All contracts</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={filtered}
          emptyMessage="No contracts yet — create one to get started."
          columns={[
            { key: 'contractNumber', label: 'Number' },
            { key: 'title', label: 'Title' },
            {
              key: 'customerId',
              label: 'Customer',
              render: (r) => customerName(r.customerId),
            },
            {
              key: 'serviceType',
              label: 'Services',
              render: (r) => {
                const labels = serviceLabels(r);
                if (labels.length === 0) return '—';
                return (
                  <div className="flex max-w-[220px] flex-wrap gap-1">
                    {labels.map((s) => (
                      <span
                        key={s}
                        className="rounded bg-[#f3f2f1] px-1.5 py-0.5 text-[10px] font-medium text-[#323130]"
                      >
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                );
              },
            },
            {
              key: 'siteIds',
              label: 'Sites',
              render: (r) => {
                const codes =
                  r.sites && r.sites.length > 0
                    ? r.sites.map((s) => s.code)
                    : [];
                if (codes.length === 0) return '—';
                return (
                  <div className="flex max-w-[180px] flex-wrap gap-1">
                    {codes.map((code) => (
                      <span
                        key={code}
                        className="rounded bg-[#deecf9] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#004578]"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                );
              },
            },
            {
              key: 'contractKind',
              label: 'Kind',
              render: (r) => {
                const kind = r.contractKind ?? 'NEW';
                return (
                  <span className="rounded bg-[#f3f2f1] px-1.5 py-0.5 text-[10px] font-medium text-[#323130]">
                    {kind.replace(/_/g, ' ')}
                  </span>
                );
              },
            },
            {
              key: 'noticePeriodDays',
              label: 'Notice',
              render: (r) =>
                r.noticePeriodDays != null ? `${r.noticePeriodDays}d` : '—',
            },
            {
              key: 'paymentTerms',
              label: 'Terms',
              render: (r) =>
                r.paymentTerms
                  ? r.paymentTerms.replace(/_/g, ' ')
                  : '—',
            },
            {
              key: 'guardCount',
              label: 'Guards',
              render: (r) =>
                r.guardCount != null && r.guardCount > 0
                  ? String(r.guardCount)
                  : '—',
            },
            {
              key: 'endDate',
              label: 'Ends',
              render: (r) =>
                r.endDate
                  ? new Date(r.endDate).toLocaleDateString('en-TZ')
                  : '—',
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => {
                const stepBadge = approvalStepBadge(r);
                return (
                  <span className="inline-flex flex-col items-start gap-1">
                    <span className="inline-flex items-center gap-1">
                      <StatusBadge status={r.status} />
                      {isExpiringSoon(r) && r.status === 'ACTIVE' ? (
                        <span className="text-[10px] font-semibold text-amber-700">
                          ≤90d
                        </span>
                      ) : null}
                    </span>
                    {stepBadge ? (
                      <span className="rounded bg-[#fff4ce] px-1.5 py-0.5 text-[10px] font-medium text-[#835c00]">
                        {stepBadge}
                      </span>
                    ) : null}
                  </span>
                );
              },
            },
            {
              key: 'monthlyFee',
              label: 'MRR',
              render: (r) =>
                fmtMoney(Number(r.monthlyFee || 0), r.currency),
            },
            {
              key: 'id',
              label: 'Actions',
              render: (r) => {
                const roleHint = approvalRoleLabel(r.approvalRequiredRole);
                const canAct = canActCurrentStep(r, sessionUser?.roles);
                return (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void openDocs(r)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#0067b8] hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Docs
                    </button>
                    {r.status === 'DRAFT' ? (
                      <button
                        type="button"
                        onClick={() => void onSubmitApproval(r.id)}
                        className="text-xs font-medium text-[#0067b8] hover:underline"
                      >
                        Submit
                      </button>
                    ) : null}
                    {r.status === 'PENDING_APPROVAL' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void onApprove(r.id)}
                          className="text-xs font-medium text-emerald-700 hover:underline"
                          title={
                            canAct
                              ? undefined
                              : `Requires ${r.approvalRequiredRole ?? 'approver'} role (API enforces)`
                          }
                        >
                          {roleHint ? `Approve (${roleHint})` : 'Approve'}
                        </button>
                        {!canAct && r.approvalRequiredRole ? (
                          <span className="text-[10px] text-[#605e5c]">
                            Needs {r.approvalRequiredRole}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void onReject(r.id)}
                          className="text-xs font-medium text-rose-600 hover:underline"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {r.status === 'APPROVED' ? (
                      <button
                        type="button"
                        onClick={() => void setStatus(r.id, 'ACTIVE')}
                        className="text-xs font-medium text-[#0067b8] hover:underline"
                      >
                        Activate
                      </button>
                    ) : null}
                    {r.status === 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={() => void setStatus(r.id, 'TERMINATED')}
                        className="text-xs font-medium text-rose-600 hover:underline"
                      >
                        Terminate
                      </button>
                    ) : null}
                    {r.status === 'EXPIRING' ? (
                      <button
                        type="button"
                        onClick={() => void setStatus(r.id, 'ACTIVE')}
                        className="text-xs font-medium text-[#0067b8] hover:underline"
                      >
                        Mark active
                      </button>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      {open ? (
        <Modal
          title="New contract"
          description="Commercial agreement — identity, services, fees, and SLA (attach signed PDFs after create)"
          onClose={() => setOpen(false)}
          size="lg"
        >
          <form
            onSubmit={(e) => void onCreate(e)}
            className="max-h-[75vh] space-y-5 overflow-y-auto pr-1"
          >
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                Identity
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#323130]">
                  Customer
                  <select
                    value={form.customerId}
                    onChange={(e) => {
                      const customerId = e.target.value;
                      setForm((f) => ({
                        ...f,
                        customerId,
                        siteIds: f.siteIds.filter((id) =>
                          sites.some(
                            (s) =>
                              s.id === id && s.customerId === customerId,
                          ),
                        ),
                      }));
                    }}
                    className={inputCls}
                    required
                  >
                    <option value="" disabled>
                      {customers.length
                        ? 'Select customer'
                        : 'No customers found'}
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-[#323130]">
                  Contract number
                  <input
                    value={form.contractNumber}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        contractNumber: e.target.value,
                      }))
                    }
                    className={inputCls}
                    required
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-[#323130]">
                Title
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className={inputCls}
                  required
                />
              </label>
              <label className="block text-sm font-medium text-[#323130] sm:max-w-xs">
                Contract kind
                <select
                  value={form.contractKind}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contractKind: e.target.value }))
                  }
                  className={inputCls}
                >
                  {CONTRACT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                Services
              </h3>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-[#323130]">
                  Service types (select one or more)
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SERVICE_TYPES.map((s) => {
                    const checked = form.serviceTypes.includes(s);
                    return (
                      <label
                        key={s}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          checked
                            ? 'border-[#0078d4] bg-[#deecf9] text-[#004578]'
                            : 'border-[#e1dfdd] bg-white text-[#323130]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#0078d4]"
                          checked={checked}
                          onChange={() => toggleServiceType(s)}
                        />
                        {s.replace(/_/g, ' ')}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                Sites
              </h3>
              {!form.customerId ? (
                <p className="text-xs text-[#605e5c]">
                  Select a customer to choose covered sites.
                </p>
              ) : customerSites.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  No sites registered for this customer yet. Create sites under
                  Branch Ops, then bind them here (optional).
                </p>
              ) : (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-[#323130]">
                    Covered sites (optional)
                  </legend>
                  <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                    {customerSites.map((s) => {
                      const checked = form.siteIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            checked
                              ? 'border-[#0078d4] bg-[#deecf9] text-[#004578]'
                              : 'border-[#e1dfdd] bg-white text-[#323130]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#0078d4]"
                            checked={checked}
                            onChange={() => toggleSite(s.id)}
                          />
                          <span className="min-w-0 truncate">
                            <span className="font-mono text-[11px]">
                              {s.code}
                            </span>
                            <span className="text-[#605e5c]"> — {s.name}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                Commercial
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm font-medium text-[#323130]">
                  Monthly fee
                  <input
                    type="number"
                    min={0}
                    value={form.monthlyFee}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, monthlyFee: e.target.value }))
                    }
                    className={inputCls}
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-[#323130]">
                  Currency
                  <select
                    value={form.currency}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, currency: e.target.value }))
                    }
                    className={inputCls}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-[#323130]">
                  Payment terms
                  <select
                    value={form.paymentTerms}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, paymentTerms: e.target.value }))
                    }
                    className={inputCls}
                  >
                    {PAYMENT_TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-[#323130]">
                  Invoice frequency
                  <select
                    value={form.invoiceFrequency}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        invoiceFrequency: e.target.value,
                      }))
                    }
                    className={inputCls}
                  >
                    {CONTRACT_INVOICE_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm font-medium text-[#323130]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#0078d4]"
                    checked={form.vatApplicable}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        vatApplicable: e.target.checked,
                      }))
                    }
                  />
                  VAT applicable
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm font-medium text-[#323130]">
                  Start date
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                    className={inputCls}
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-[#323130]">
                  End date
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    className={inputCls}
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-[#323130]">
                  Guard count
                  <input
                    type="number"
                    min={0}
                    value={form.guardCount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, guardCount: e.target.value }))
                    }
                    className={inputCls}
                    placeholder="e.g. 12"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                Dates
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#323130]">
                  Renewal date
                  <input
                    type="date"
                    value={form.renewalDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, renewalDate: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
                <label className="block text-sm font-medium text-[#323130]">
                  Notice period (days)
                  <input
                    type="number"
                    min={0}
                    value={form.noticePeriodDays}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        noticePeriodDays: e.target.value,
                      }))
                    }
                    className={inputCls}
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                SLA
              </h3>
              <label className="block text-sm font-medium text-[#323130] sm:max-w-xs">
                SLA level
                <select
                  value={form.slaLevel}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slaLevel: e.target.value }))
                  }
                  className={inputCls}
                >
                  {CONTRACT_SLA_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                SLA terms
                <textarea
                  rows={3}
                  value={form.slaTerms}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slaTerms: e.target.value }))
                  }
                  className={inputCls}
                  placeholder="Response times, reporting, penalties…"
                />
              </label>
            </section>

            <p className="text-xs text-[#605e5c]">
              After create, use Docs on the row to upload the signed contract PDF
              (requires documents.manage + contracts.manage).
            </p>

            {error ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  saving || !form.customerId || form.serviceTypes.length === 0
                }
                className={btnPrimary}
              >
                {saving ? 'Creating…' : 'Create contract'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {docsFor ? (
        <Modal
          title={`Contract documents — ${docsFor.contractNumber}`}
          description="Signed agreements and amendments (pdf/png/jpeg/webp ≤10MB). Customer portal can view these read-only."
          onClose={() => {
            setDocsFor(null);
            setDocs([]);
            setDocsFile(null);
            setDocsError(null);
          }}
          size="md"
        >
          <form onSubmit={(e) => void onUploadDoc(e)} className="space-y-3">
            <label className="block text-sm font-medium text-[#323130]">
              Upload file
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                className={`${inputCls} mt-1`}
                onChange={(e) => setDocsFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                className={btnPrimary}
                disabled={docsUploading || !docsFile}
              >
                {docsUploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </form>

          {docsError ? (
            <p className="mt-3 text-sm text-rose-600">{docsError}</p>
          ) : null}

          <div className="mt-4">
            {docsLoading ? (
              <p className="text-sm text-[#605e5c]">Loading…</p>
            ) : docs.length === 0 ? (
              <p className="text-sm text-[#605e5c]">No files attached yet.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#e1dfdd] px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#1b1a19]">
                        {d.fileName}
                      </p>
                      <p className="text-xs text-[#605e5c]">
                        {formatBytes(d.sizeBytes)} ·{' '}
                        {new Date(d.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-[#0067b8] hover:underline"
                      onClick={() => void onDownloadDoc(d)}
                    >
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
