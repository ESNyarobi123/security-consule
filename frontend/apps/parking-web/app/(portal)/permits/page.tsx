'use client';

import {
  approvePermit,
  billPermit,
  createPermit,
  listParkingSiteOptions,
  listParkingVisitorAppointmentOptions,
  listPermits,
  listVehicles,
  rejectPermit,
  updatePermit,
  type ParkingBillingPeriod,
  type ParkingOpsPermit,
  type ParkingOpsVehicle,
  type ParkingSiteOption,
  type ParkingVisitorAppointmentOption,
} from '@pssms/api-client';
import {
  Check,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Ticket,
  Wallet,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  VEHICLE_META,
  VehicleGlyph,
  normalizeVehicleType,
  type VehicleKind,
} from '../_components/parking-ui';

type StatusFilter = 'ALL' | 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'SUSPENDED';
type ViewMode = 'cards' | 'table';
type PermitKind =
  | 'EMPLOYEE'
  | 'VISITOR'
  | 'CONTRACTOR'
  | 'SUPPLIER'
  | 'RESERVED';

const PERMIT_TYPES: PermitKind[] = [
  'EMPLOYEE',
  'VISITOR',
  'CONTRACTOR',
  'SUPPLIER',
  'RESERVED',
];

const BILLING_PERIODS: { id: ParkingBillingPeriod; label: string }[] = [
  { id: 'ONE_TIME', label: 'One-time' },
  { id: 'DAILY', label: 'Daily' },
  { id: 'MONTHLY', label: 'Monthly' },
];

const fieldCls =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatFee(
  amount?: number | null,
  currency?: string | null,
): string | null {
  if (amount == null || Number.isNaN(amount)) return null;
  const cur = currency?.trim() || 'TZS';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur.length === 3 ? cur : 'TZS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${cur}`;
  }
}

function statusTone(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    case 'REVOKED':
    case 'EXPIRED':
      return 'bg-rose-50 text-rose-800 ring-rose-200';
    case 'SUSPENDED':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function typeTone(type: string): string {
  switch (type) {
    case 'EMPLOYEE':
      return 'bg-blue-50 text-blue-800';
    case 'VISITOR':
      return 'bg-sky-50 text-sky-800';
    case 'CONTRACTOR':
      return 'bg-orange-50 text-orange-800';
    case 'SUPPLIER':
      return 'bg-teal-50 text-teal-800';
    case 'RESERVED':
      return 'bg-violet-50 text-violet-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function PermitsPage() {
  const [permits, setPermits] = useState<ParkingOpsPermit[]>([]);
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [sites, setSites] = useState<ParkingSiteOption[]>([]);
  const [appointments, setAppointments] = useState<
    ParkingVisitorAppointmentOption[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('cards');
  const [feeEdit, setFeeEdit] = useState<ParkingOpsPermit | null>(null);
  const [feeDraft, setFeeDraft] = useState('');
  const [currencyDraft, setCurrencyDraft] = useState('TZS');
  const [periodDraft, setPeriodDraft] =
    useState<ParkingBillingPeriod>('ONE_TIME');
  const [unitRateDraft, setUnitRateDraft] = useState('');
  const [quantityDraft, setQuantityDraft] = useState('');
  const [discountDraft, setDiscountDraft] = useState('');
  const [penaltyDraft, setPenaltyDraft] = useState('');
  const [savingFee, setSavingFee] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [showIssue, setShowIssue] = useState(true);
  const [issueVehicleId, setIssueVehicleId] = useState('');
  const [issueSiteId, setIssueSiteId] = useState('');
  const [issueType, setIssueType] = useState<PermitKind>('EMPLOYEE');
  const [issueAppointmentId, setIssueAppointmentId] = useState('');
  const [issuePeriod, setIssuePeriod] =
    useState<ParkingBillingPeriod>('ONE_TIME');
  const [issueUnitRate, setIssueUnitRate] = useState('');
  const [issueQuantity, setIssueQuantity] = useState('');
  const [issueDiscount, setIssueDiscount] = useState('');
  const [issuePenalty, setIssuePenalty] = useState('');
  const [issueFee, setIssueFee] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, v, s, a] = await Promise.all([
        listPermits(),
        listVehicles(),
        listParkingSiteOptions().catch(() => [] as ParkingSiteOption[]),
        listParkingVisitorAppointmentOptions().catch(
          () => [] as ParkingVisitorAppointmentOption[],
        ),
      ]);
      setPermits(p);
      setVehicles(v.filter((x) => x.isActive));
      setSites(s);
      setAppointments(a);
      setIssueSiteId((prev) =>
        prev && s.some((x) => x.id === prev) ? prev : (s[0]?.id ?? ''),
      );
      setIssueVehicleId((prev) =>
        prev && v.some((x) => x.id === prev && x.isActive)
          ? prev
          : (v.find((x) => x.isActive)?.id ?? ''),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const appointmentChoices = useMemo(() => {
    if (issueType !== 'VISITOR' && issueType !== 'CONTRACTOR') return [];
    return appointments.filter((a) => !issueSiteId || a.siteId === issueSiteId);
  }, [appointments, issueSiteId, issueType]);

  async function onIssue(e: FormEvent) {
    e.preventDefault();
    setIssuing(true);
    setIssueError(null);
    try {
      if (!issueVehicleId || !issueSiteId) {
        setIssueError('Select vehicle and site');
        return;
      }
      const parseOpt = (s: string) => {
        const t = s.trim();
        if (!t) return undefined;
        const n = Number(t.replace(/,/g, ''));
        if (Number.isNaN(n) || n < 0) return 'bad' as const;
        return n;
      };
      const unitRate = parseOpt(issueUnitRate);
      const quantity = parseOpt(issueQuantity);
      const discountAmount = parseOpt(issueDiscount);
      const penaltyAmount = parseOpt(issuePenalty);
      const feeAmount = parseOpt(issueFee);
      if (
        unitRate === 'bad' ||
        quantity === 'bad' ||
        discountAmount === 'bad' ||
        penaltyAmount === 'bad' ||
        feeAmount === 'bad'
      ) {
        setIssueError('Charge fields must be non-negative numbers');
        return;
      }
      const created = await createPermit({
        vehicleId: issueVehicleId,
        siteId: issueSiteId,
        permitType: issueType,
        billingPeriod: issuePeriod,
        unitRate,
        quantity,
        discountAmount,
        penaltyAmount,
        feeAmount,
        currency:
          unitRate != null || feeAmount != null ? 'TZS' : undefined,
        visitorAppointmentId:
          (issueType === 'VISITOR' || issueType === 'CONTRACTOR') &&
          issueAppointmentId
            ? issueAppointmentId
            : undefined,
      });
      setPermits((prev) => [created, ...prev]);
      setIssueAppointmentId('');
      setIssueFee('');
      setIssueUnitRate('');
      setIssueQuantity('');
      setIssueDiscount('');
      setIssuePenalty('');
      setIssuePeriod('ONE_TIME');
      setStatusFilter('PENDING');
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : 'Issue failed');
    } finally {
      setIssuing(false);
    }
  }

  function openFeeEdit(p: ParkingOpsPermit) {
    setFeeEdit(p);
    setFeeDraft(
      p.feeAmount != null && !Number.isNaN(p.feeAmount)
        ? String(p.feeAmount)
        : '',
    );
    setCurrencyDraft(p.currency?.trim() || 'TZS');
    setPeriodDraft(
      (p.billingPeriod as ParkingBillingPeriod) || 'ONE_TIME',
    );
    setUnitRateDraft(
      p.unitRate != null && !Number.isNaN(p.unitRate) ? String(p.unitRate) : '',
    );
    setQuantityDraft(
      p.quantity != null && !Number.isNaN(p.quantity) ? String(p.quantity) : '',
    );
    setDiscountDraft(
      p.discountAmount != null && !Number.isNaN(p.discountAmount)
        ? String(p.discountAmount)
        : '',
    );
    setPenaltyDraft(
      p.penaltyAmount != null && !Number.isNaN(p.penaltyAmount)
        ? String(p.penaltyAmount)
        : '',
    );
    setModalError(null);
  }

  async function onSaveFee(e: FormEvent) {
    e.preventDefault();
    if (!feeEdit) return;
    setSavingFee(true);
    setModalError(null);
    try {
      const parseOpt = (s: string) => {
        const t = s.trim();
        if (!t) return null;
        const n = Number(t.replace(/,/g, ''));
        if (Number.isNaN(n) || n < 0) return 'bad' as const;
        return n;
      };
      const unitRate = parseOpt(unitRateDraft);
      const quantity = parseOpt(quantityDraft);
      const discountAmount = parseOpt(discountDraft);
      const penaltyAmount = parseOpt(penaltyDraft);
      const feeAmount = parseOpt(feeDraft);
      if (
        unitRate === 'bad' ||
        quantity === 'bad' ||
        discountAmount === 'bad' ||
        penaltyAmount === 'bad' ||
        feeAmount === 'bad'
      ) {
        setModalError('Enter valid non-negative amounts');
        return;
      }
      await updatePermit(feeEdit.id, {
        billingPeriod: periodDraft,
        unitRate,
        quantity,
        discountAmount,
        penaltyAmount,
        feeAmount,
        currency: currencyDraft.trim() || 'TZS',
      });
      setFeeEdit(null);
      await load();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingFee(false);
    }
  }

  async function onBill(id: string, send = false) {
    const msg = send
      ? 'Create and SEND finance invoice for this permit charge?'
      : 'Create a DRAFT finance invoice for this permit charge?';
    if (!window.confirm(msg)) return;
    setBusyId(id);
    setError(null);
    try {
      const billed = await billPermit(id, { send });
      await load();
      if (billed.invoiceNumber) {
        window.alert(
          `${send ? 'Sent' : 'Draft'} invoice ${billed.invoiceNumber}` +
            (billed.invoiceStatus ? ` · ${billed.invoiceStatus}` : ''),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bill failed');
    } finally {
      setBusyId(null);
    }
  }

  const vehicleById = useMemo(() => {
    const m = new Map<string, ParkingOpsVehicle>();
    for (const v of vehicles) m.set(v.id, v);
    return m;
  }, [vehicles]);

  const enriched = useMemo(() => {
    return permits.map((p) => {
      const veh = vehicleById.get(p.vehicleId);
      const kind = normalizeVehicleType(veh?.vehicleType);
      return {
        ...p,
        plate: p.plateNumber || veh?.plateNumber || '—',
        site: p.siteName || p.siteCode || 'Site',
        kind,
        makeModel: [veh?.make, veh?.model].filter(Boolean).join(' ') || null,
        owner: veh?.ownerName || null,
      };
    });
  }, [permits, vehicleById]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      ALL: enriched.length,
      PENDING: 0,
      ACTIVE: 0,
      REVOKED: 0,
      EXPIRED: 0,
      SUSPENDED: 0,
    };
    for (const p of enriched) {
      c[p.status] = (c[p.status] ?? 0) + 1;
    }
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && p.kind !== typeFilter) return false;
      if (!q) return true;
      return (
        p.permitNumber.toLowerCase().includes(q) ||
        p.plate.toLowerCase().includes(q) ||
        p.site.toLowerCase().includes(q) ||
        p.permitType.toLowerCase().includes(q) ||
        (p.owner ?? '').toLowerCase().includes(q) ||
        (p.makeModel ?? '').toLowerCase().includes(q) ||
        (p.visitorReferenceNumber ?? '').toLowerCase().includes(q) ||
        (p.visitorName ?? '').toLowerCase().includes(q)
      );
    });
  }, [enriched, statusFilter, typeFilter, search]);

  async function onApprove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await approvePermit(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await rejectPermit(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  const statusChips: { id: StatusFilter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'ACTIVE', label: 'Active' },
    { id: 'REVOKED', label: 'Revoked' },
    { id: 'EXPIRED', label: 'Expired' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Access · Module 13-O
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            Permits
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Issue permits with daily/monthly/one-time charges, discounts and
            penalties. Bill creates a finance invoice; track payment status on
            the permit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowIssue((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {showIssue ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showIssue ? 'Hide issue' : 'Issue permit'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {showIssue ? (
        <form
          onSubmit={(ev) => void onIssue(ev)}
          className="rounded-2xl border border-slate-800 bg-[#0f2744] p-5 text-white shadow-lg"
        >
          <h2 className="text-lg font-semibold">Issue permit</h2>
          <p className="mt-1 text-xs text-slate-300">
            Starts PENDING — another officer must approve.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Vehicle *
              </span>
              <select
                value={issueVehicleId}
                onChange={(e) => setIssueVehicleId(e.target.value)}
                required
                className={fieldCls}
              >
                <option value="">Select…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber}
                    {v.ownerName ? ` · ${v.ownerName}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Site *
              </span>
              <select
                value={issueSiteId}
                onChange={(e) => {
                  setIssueSiteId(e.target.value);
                  setIssueAppointmentId('');
                }}
                required
                className={fieldCls}
              >
                <option value="">Select…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Type *
              </span>
              <select
                value={issueType}
                onChange={(e) => {
                  const t = e.target.value as PermitKind;
                  setIssueType(t);
                  if (t !== 'VISITOR' && t !== 'CONTRACTOR') {
                    setIssueAppointmentId('');
                  }
                }}
                className={fieldCls}
              >
                {PERMIT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {(issueType === 'VISITOR' || issueType === 'CONTRACTOR') && (
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Visitor appointment (optional)
                </span>
                <select
                  value={issueAppointmentId}
                  onChange={(e) => setIssueAppointmentId(e.target.value)}
                  className={fieldCls}
                >
                  <option value="">— No link —</option>
                  {appointmentChoices.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.referenceNumber} · {a.visitorName} · {a.status}
                      {a.vehiclePlate ? ` · ${a.vehiclePlate}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Billing period
              </span>
              <select
                value={issuePeriod}
                onChange={(e) =>
                  setIssuePeriod(e.target.value as ParkingBillingPeriod)
                }
                className={fieldCls}
              >
                {BILLING_PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Unit rate (TZS)
              </span>
              <input
                value={issueUnitRate}
                onChange={(e) => setIssueUnitRate(e.target.value)}
                inputMode="decimal"
                placeholder={
                  issuePeriod === 'DAILY'
                    ? 'Per day'
                    : issuePeriod === 'MONTHLY'
                      ? 'Per month'
                      : 'Flat rate'
                }
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Qty (days/months)
              </span>
              <input
                value={issueQuantity}
                onChange={(e) => setIssueQuantity(e.target.value)}
                inputMode="decimal"
                placeholder="Auto from dates if blank"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Discount
              </span>
              <input
                value={issueDiscount}
                onChange={(e) => setIssueDiscount(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Penalty
              </span>
              <input
                value={issuePenalty}
                onChange={(e) => setIssuePenalty(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Or flat fee (legacy)
              </span>
              <input
                value={issueFee}
                onChange={(e) => setIssueFee(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 150000"
                className={fieldCls}
              />
            </label>
          </div>
          {issueError ? (
            <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
              {issueError}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={issuing || !vehicles.length || !sites.length}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-bold text-white hover:bg-teal-400 disabled:opacity-60"
            >
              <Ticket className="h-4 w-4" />
              {issuing ? 'Issuing…' : 'Issue permit'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{counts.ALL}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700/80">
            Pending approval
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-800">
            {counts.PENDING ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700/80">
            Active
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-800">
            {counts.ACTIVE ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Showing
          </p>
          <p className="mt-1 text-3xl font-bold text-[#2563eb]">
            {filtered.length}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, permit #, site, owner…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {statusChips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setStatusFilter(c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === c.id
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.label}
              <span className="ml-1 opacity-80">({counts[c.id] ?? 0})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'CAR', 'MOTORCYCLE', 'TRUCK', 'BUS'] as const).map((t) => {
            const active = typeFilter === t;
            const meta = t === 'ALL' ? null : VEHICLE_META[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className="rounded-full px-3 py-1.5 text-xs font-bold transition"
                style={
                  active && meta
                    ? {
                        background: meta.accent,
                        color: '#fff',
                      }
                    : active
                      ? { background: '#0f172a', color: '#fff' }
                      : {
                          background: meta?.soft ?? '#f1f5f9',
                          color: meta?.accent ?? '#475569',
                        }
                }
              >
                {t === 'ALL' ? 'All types' : meta!.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex rounded-xl border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setView('cards')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              view === 'cards'
                ? 'bg-[#2563eb] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              view === 'table'
                ? 'bg-[#2563eb] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading permits…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-slate-700">No permits match</p>
          <p className="mt-1 text-sm text-slate-500">
            Try clearing filters or search.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const meta = VEHICLE_META[p.kind];
            const pending = p.status === 'PENDING';
            return (
              <article
                key={p.id}
                className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                style={{ borderColor: `${meta.accent}40` }}
              >
                <div
                  className="flex items-start gap-3 px-4 py-3"
                  style={{
                    background: `linear-gradient(135deg, ${meta.soft} 0%, #ffffff 70%)`,
                  }}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: '#fff', boxShadow: `0 0 0 1px ${meta.accent}33` }}
                  >
                    <VehicleGlyph kind={p.kind} className="h-9 w-9" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${statusTone(p.status)}`}
                      >
                        {p.status}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${typeTone(p.permitType)}`}
                      >
                        {p.permitType}
                      </span>
                      {p.visitorReferenceNumber ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800 ring-1 ring-sky-200">
                          {p.visitorReferenceNumber}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 font-mono text-lg font-bold tracking-wide text-slate-900">
                      {p.plate}
                    </p>
                    <p className="truncate text-xs font-semibold" style={{ color: meta.accent }}>
                      {meta.label}
                      {p.makeModel ? ` · ${p.makeModel}` : ''}
                      {p.visitorName ? ` · ${p.visitorName}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-bold text-slate-500">
                      {p.permitNumber}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0d9488]" />
                    <span className="font-medium">{p.site}</span>
                  </div>
                  {p.owner ? (
                    <p className="text-xs text-slate-500">Owner · {p.owner}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {formatFee(p.feeAmount, p.currency) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-200">
                        <Wallet className="h-3 w-3" />
                        {formatFee(p.feeAmount, p.currency)}
                        {p.billingPeriod && p.billingPeriod !== 'ONE_TIME'
                          ? ` · ${p.billingPeriod}`
                          : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        No fee
                      </span>
                    )}
                    {p.invoiceNumber ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-800 ring-1 ring-teal-200">
                        <Receipt className="h-3 w-3" />
                        {p.invoiceNumber}
                        {p.invoiceStatus ? ` · ${p.invoiceStatus}` : ''}
                      </span>
                    ) : null}
                    {p.balanceDue != null && p.balanceDue > 0 ? (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 ring-1 ring-rose-200">
                        Due {formatFee(p.balanceDue, p.currency)}
                      </span>
                    ) : null}
                    {p.invoiceStatus === 'PAID' ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                        Paid
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <div>
                      <p className="font-semibold uppercase tracking-wider text-slate-400">
                        From
                      </p>
                      <p className="font-bold text-slate-800">{formatDate(p.validFrom)}</p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wider text-slate-400">
                        Until
                      </p>
                      <p className="font-bold text-slate-800">{formatDate(p.validUntil)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
                  {pending ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void onApprove(p.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {busyId === p.id ? '…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void onReject(p.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </>
                  ) : null}
                  {!p.invoiceId ? (
                    <button
                      type="button"
                      onClick={() => openFeeEdit(p)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Edit fee
                    </button>
                  ) : null}
                  {p.status === 'ACTIVE' &&
                  p.feeAmount != null &&
                  p.feeAmount > 0 &&
                  !p.invoiceId ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void onBill(p.id, false)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0d9488] px-3 py-2 text-xs font-bold text-white hover:bg-teal-600 disabled:opacity-60"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        {busyId === p.id ? '…' : 'Bill draft'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void onBill(p.id, true)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-900 disabled:opacity-60"
                      >
                        Send invoice
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Permit</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Valid</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const meta = VEHICLE_META[p.kind];
                const feeLabel = formatFee(p.feeAmount, p.currency);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ background: meta.soft }}
                        >
                          <VehicleGlyph kind={p.kind} className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="font-mono font-bold text-slate-900">{p.plate}</p>
                          <p className="text-[11px] font-semibold" style={{ color: meta.accent }}>
                            {meta.label}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                      {p.permitNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${typeTone(p.permitType)}`}
                      >
                        {p.permitType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${statusTone(p.status)}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {feeLabel ? (
                        <div>
                          <p className="font-bold text-slate-800">{feeLabel}</p>
                          {p.invoiceNumber ? (
                            <p className="font-mono text-[10px] text-teal-700">
                              {p.invoiceNumber}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{p.site}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatDate(p.validFrom)} → {formatDate(p.validUntil)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {p.status === 'PENDING' ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => void onApprove(p.id)}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => void onReject(p.id)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {!p.invoiceId ? (
                          <button
                            type="button"
                            onClick={() => openFeeEdit(p)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700"
                          >
                            Fee
                          </button>
                        ) : null}
                        {p.status === 'ACTIVE' &&
                        p.feeAmount != null &&
                        p.feeAmount > 0 &&
                        !p.invoiceId ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => void onBill(p.id, false)}
                              className="rounded-lg bg-[#0d9488] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60"
                            >
                              Bill
                            </button>
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => void onBill(p.id, true)}
                              className="rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-900 disabled:opacity-60"
                            >
                              Send
                            </button>
                          </>
                        ) : null}
                        {p.invoiceId ? (
                          <span className="text-[11px] font-semibold text-teal-700">
                            {p.invoiceStatus ?? 'Billed'}
                            {p.balanceDue != null && p.balanceDue > 0
                              ? ` · due ${p.balanceDue}`
                              : ''}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {feeEdit ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Module 13-O
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  Edit charges
                </h2>
                <p className="mt-1 font-mono text-sm text-slate-600">
                  {feeEdit.permitNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFeeEdit(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => void onSaveFee(e)}
              className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4"
            >
              {modalError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {modalError}
                </p>
              ) : null}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Billing period
                </label>
                <select
                  value={periodDraft}
                  onChange={(e) =>
                    setPeriodDraft(e.target.value as ParkingBillingPeriod)
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#2563eb] focus:bg-white"
                >
                  {BILLING_PERIODS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Unit rate
                  </label>
                  <input
                    value={unitRateDraft}
                    onChange={(e) => setUnitRateDraft(e.target.value)}
                    inputMode="decimal"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Quantity
                  </label>
                  <input
                    value={quantityDraft}
                    onChange={(e) => setQuantityDraft(e.target.value)}
                    inputMode="decimal"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Discount
                  </label>
                  <input
                    value={discountDraft}
                    onChange={(e) => setDiscountDraft(e.target.value)}
                    inputMode="decimal"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Penalty
                  </label>
                  <input
                    value={penaltyDraft}
                    onChange={(e) => setPenaltyDraft(e.target.value)}
                    inputMode="decimal"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#2563eb] focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Flat fee override (optional)
                </label>
                <input
                  value={feeDraft}
                  onChange={(e) => setFeeDraft(e.target.value)}
                  inputMode="decimal"
                  placeholder="Leave blank to calc from rate × qty"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#2563eb] focus:bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Currency
                </label>
                <input
                  value={currencyDraft}
                  onChange={(e) =>
                    setCurrencyDraft(e.target.value.toUpperCase())
                  }
                  maxLength={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-[#2563eb] focus:bg-white"
                />
              </div>
              <p className="text-xs text-slate-500">
                Net fee = rate × qty − discount + penalty. Bill draft or send
                invoice after ACTIVE.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFeeEdit(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFee}
                  className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {savingFee ? 'Saving…' : 'Save charges'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
