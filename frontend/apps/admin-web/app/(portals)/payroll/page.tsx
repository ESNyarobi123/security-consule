'use client';

import {
  approvePayrollCycle,
  createPayrollCycle,
  downloadPayrollBankFile,
  downloadPayrollMobileFile,
  generatePayrollCycle,
  getPayrollApprovalReport,
  getPayrollInvoiceGate,
  getPayrollLoanReport,
  getPayrollRegister,
  getPayrollStatutoryReport,
  grantPayrollPayException,
  getPayslip,
  listCustomers,
  listPayrollCycles,
  listPayrollDueAlerts,
  listPayslips,
  markPayrollPaid,
  scanPayrollDueAlerts,
  submitPayrollCycle,
  type Customer,
  type PayrollCycle,
  type PayrollDueAlert,
  type PayrollInvoiceGate,
  type PayslipSnapshot,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import {
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  CalendarRange,
  CheckCircle2,
  FileSpreadsheet,
  Loader,
  Lock,
  Plus,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  PayrollCycleRoster,
  PayslipRoster,
} from './_components/PayrollRosters';

function money(n: number) {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);
}

function monthDefaults() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

type StatusFilter =
  | 'all'
  | 'DRAFT'
  | 'CALCULATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAID';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'CALCULATED', label: 'Calculated' },
  { id: 'PENDING_APPROVAL', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'PAID', label: 'Paid' },
];

export default function PayrollPage() {
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [payslips, setPayslips] = useState<PayslipSnapshot[]>([]);
  const [allPayslips, setAllPayslips] = useState<PayslipSnapshot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [showCreate, setShowCreate] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [tenantType, setTenantType] = useState<
    'INTERNAL_COMPANY' | 'CUSTOMER_MANAGED_PAYROLL'
  >('INTERNAL_COMPANY');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [detailPayslip, setDetailPayslip] = useState<PayslipSnapshot | null>(
    null,
  );
  const [reportBusy, setReportBusy] = useState<string | null>(null);
  const [dueAlerts, setDueAlerts] = useState<PayrollDueAlert[]>([]);
  const [invoiceGate, setInvoiceGate] = useState<PayrollInvoiceGate | null>(
    null,
  );
  const [scanBusy, setScanBusy] = useState(false);

  const user = getSessionUser();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPayrollCycles();
      setCycles(list);
      const [slipArrays, alerts] = await Promise.all([
        Promise.all(
          list.map((c) =>
            listPayslips(c.id).catch(() => [] as PayslipSnapshot[]),
          ),
        ),
        listPayrollDueAlerts().catch(() => [] as PayrollDueAlert[]),
      ]);
      setAllPayslips(slipArrays.flat());
      setDueAlerts(alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cycles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const draft = cycles.filter((c) => c.status === 'DRAFT').length;
    const inProgress = cycles.filter(
      (c) => c.status !== 'APPROVED' && c.status !== 'PAID',
    ).length;
    const approvedPaid = cycles.filter(
      (c) => c.status === 'APPROVED' || c.status === 'PAID',
    ).length;
    const paid = cycles.filter((c) => c.status === 'PAID').length;
    const netTotal = allPayslips.reduce((sum, p) => sum + (p.netPay ?? 0), 0);
    return {
      total: cycles.length,
      draft,
      inProgress,
      approvedPaid,
      paid,
      netTotal,
      slipCount: allPayslips.length,
    };
  }, [cycles, allPayslips]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: cycles.length,
      DRAFT: 0,
      CALCULATED: 0,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      PAID: 0,
    };
    for (const row of cycles) {
      const s = row.status as StatusFilter;
      if (s in c && s !== 'all') c[s] += 1;
    }
    return c;
  }, [cycles]);

  const filteredCycles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cycles.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.cycleCode.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q) ||
        String(c.periodStart).includes(q) ||
        String(c.periodEnd).includes(q)
      );
    });
  }, [cycles, query, statusFilter]);

  async function openPayslipDetail(id: string) {
    setDetailPayslip(await getPayslip(id));
  }

  async function runReport(
    kind: 'register' | 'loan' | 'statutory' | 'approval' | 'bank' | 'mobile',
  ) {
    if (!selected) return;
    setReportBusy(kind);
    setError(null);
    try {
      if (kind === 'register') {
        const reg = await getPayrollRegister(selected);
        const csv = [
          'employeeNumber,employeeName,grossPay,totalDeductions,netPay',
          ...reg.rows.map(
            (r) =>
              `${r.employeeNumber},${r.employeeName},${r.grossPay},${r.totalDeductions},${r.netPay}`,
          ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedCycle?.cycleCode ?? 'payroll'}-register.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (kind === 'loan') {
        await getPayrollLoanReport(selected);
        window.alert('Loan deduction report loaded — use Register export for full CSV pack (API JSON available).');
      } else if (kind === 'statutory') {
        const rep = await getPayrollStatutoryReport(selected);
        window.alert(
          `Statutory: NSSF ${money(rep.nssfTotal)} · PAYE ${money(rep.payeTotal)} (${rep.headcount} employees)`,
        );
      } else if (kind === 'approval') {
        const rep = await getPayrollApprovalReport(selected);
        window.alert(
          `Approval trail: ${rep.steps.length} action(s) · status ${rep.cycle.status}`,
        );
      } else if (kind === 'bank') {
        await downloadPayrollBankFile(selected);
      } else if (kind === 'mobile') {
        await downloadPayrollMobileFile(selected);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report failed');
    } finally {
      setReportBusy(null);
    }
  }

  async function openPayslips(cycleId: string) {
    setSelected(cycleId);
    setPayslips(await listPayslips(cycleId));
    const cycle = cycles.find((c) => c.id === cycleId);
    if (cycle?.tenantType === 'CUSTOMER_MANAGED_PAYROLL') {
      try {
        setInvoiceGate(await getPayrollInvoiceGate(cycleId));
      } catch {
        setInvoiceGate(null);
      }
    } else {
      setInvoiceGate(null);
    }
  }

  async function runAction(
    cycle: PayrollCycle,
    action: 'generate' | 'submit' | 'approve' | 'pay',
  ) {
    setError(null);
    setBusyId(cycle.id);
    try {
      if (action === 'generate') await generatePayrollCycle(cycle.id);
      if (action === 'submit') await submitPayrollCycle(cycle.id);
      if (action === 'approve') {
        if (user && cycle.createdBy === user.id) {
          setError('Creator cannot approve this payroll cycle');
          return;
        }
        await approvePayrollCycle(cycle.id);
      }
      if (action === 'pay') {
        const ref = window.prompt('Payment reference') ?? '';
        if (!ref.trim()) return;
        await markPayrollPaid(cycle.id, { paymentReference: ref.trim() });
      }
      await load();
      if (selected === cycle.id) await openPayslips(cycle.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  function openCreate() {
    const d = monthDefaults();
    setPeriodStart(d.start);
    setPeriodEnd(d.end);
    setTenantType('INTERNAL_COMPANY');
    setCustomerId('');
    setCreateError(null);
    setShowCreate(true);
    void listCustomers()
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!periodStart || !periodEnd) {
      setCreateError('Select a period start and end date');
      return;
    }
    if (periodEnd < periodStart) {
      setCreateError('Period end must be on or after the start date');
      return;
    }
    if (tenantType === 'CUSTOMER_MANAGED_PAYROLL' && !customerId) {
      setCreateError('Select a customer for customer-managed payroll');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createPayrollCycle({
        periodStart,
        periodEnd,
        tenantType,
        ...(tenantType === 'CUSTOMER_MANAGED_PAYROLL'
          ? { customerId }
          : {}),
      });
      setShowCreate(false);
      await load();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create cycle',
      );
    } finally {
      setCreating(false);
    }
  }

  const selectedCycle = cycles.find((c) => c.id === selected) ?? null;
  const selectedNet = payslips.reduce((sum, p) => sum + (p.netPay ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Payroll cycles and immutable payslip snapshots — frozen at generation, never recomputed from live attendance."
        actions={
          <button type="button" onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" />
            New cycle
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total cycles"
          value={stats.total}
          hint={stats.draft > 0 ? `${stats.draft} in draft` : 'All periods'}
          accent="blue"
          icon={<CalendarRange className="h-5 w-5" />}
        />
        <StatCard
          label="In progress"
          value={stats.inProgress}
          hint="Draft, calculated or awaiting approval"
          accent="amber"
          icon={<Loader className="h-5 w-5" />}
        />
        <StatCard
          label="Approved / paid"
          value={stats.approvedPaid}
          hint={`${stats.paid} paid out`}
          accent="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Total net pay"
          value={money(stats.netTotal)}
          hint={`${stats.slipCount} payslip snapshot${stats.slipCount === 1 ? '' : 's'}`}
          accent="violet"
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-[#e1dfdd] bg-[#eff6fc] px-4 py-3 text-[13px] text-[#005a9e]">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Amounts are frozen snapshots. Attendance changes after a cycle is
          generated do not alter these payslips.
        </span>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {dueAlerts.length > 0 ? (
        <section className="mt-6 rounded-xl border border-[#c7e0f4] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-[#1b1a19]">
              E-payroll due alerts
            </h2>
            <button
              type="button"
              disabled={scanBusy}
              onClick={async () => {
                setScanBusy(true);
                setError(null);
                try {
                  const res = await scanPayrollDueAlerts(true);
                  setError(
                    `Scan: ${res.alertsCreated} alert(s), ${res.skippedUnpaid} unpaid skipped`,
                  );
                  await load();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : 'Scan failed',
                  );
                } finally {
                  setScanBusy(false);
                }
              }}
              className={btnSecondary}
            >
              {scanBusy ? 'Scanning…' : 'Scan due alerts'}
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {dueAlerts.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2"
              >
                <p className="font-semibold text-[#323130]">
                  {a.customerName ?? a.customerCode} · {a.payrollMonth}
                </p>
                <p className="text-[12px] text-[#605e5c]">
                  Invoice {a.invoiceNumber ?? '—'} · paid{' '}
                  {money(a.invoiceAmountPaid)} · {a.employeesCovered} employees
                  · due {a.dueDate.slice(0, 10)} · portion{' '}
                  {money(a.payrollPortionDue)} · invoice {a.invoicePaymentStatus}{' '}
                  · approval {a.payrollApprovalStatus} · officer{' '}
                  {a.responsibleOfficerName ?? '—'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-dashed border-[#e1dfdd] px-4 py-3 text-[13px] text-[#605e5c]">
          <span>
            Customer payroll disbursement is due on the 1st of the following
            month only if the related invoice is fully paid.
          </span>
          <button
            type="button"
            disabled={scanBusy}
            onClick={async () => {
              setScanBusy(true);
              setError(null);
              try {
                await scanPayrollDueAlerts(true);
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Scan failed');
              } finally {
                setScanBusy(false);
              }
            }}
            className={btnSecondary}
          >
            {scanBusy ? 'Scanning…' : 'Scan now'}
          </button>
        </div>
      )}

      {invoiceGate && selectedCycle?.tenantType === 'CUSTOMER_MANAGED_PAYROLL' ? (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            invoiceGate.eligible
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {invoiceGate.eligible ? (
            <p>
              Invoice {invoiceGate.invoiceNumber} is fully paid
              {invoiceGate.exceptionApproved
                ? ' (management exception recorded)'
                : ''}
              . Customer payroll disbursement is allowed.
            </p>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p>{invoiceGate.blockedReason}</p>
              {user?.roles.some((r) =>
                ['SUPER_ADMIN', 'GENERAL_MANAGER', 'CEO', 'CMD'].includes(r),
              ) ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={async () => {
                    const reason =
                      window.prompt('Exception reason (required for audit)') ??
                      '';
                    if (!reason.trim() || !selected) return;
                    try {
                      setInvoiceGate(
                        await grantPayrollPayException(selected, {
                          reason: reason.trim(),
                        }),
                      );
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : 'Exception failed',
                      );
                    }
                  }}
                >
                  Grant exception
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <section className="mt-8">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[#1b1a19]">
                Payroll cycles
              </h2>
              <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
                {cycles.length}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#605e5c]">
              Create → generate snapshots → submit → approve → mark paid
            </p>
          </div>
        </div>

        <PayrollCycleRoster
          rows={filteredCycles}
          loading={loading}
          selectedId={selected}
          busyId={busyId}
          onOpenPayslips={(id) => void openPayslips(id)}
          onAction={(c, a) => void runAction(c, a)}
          toolbar={
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
                <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cycle code or period…"
                  className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => {
                  const active = statusFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-[#0078d4] text-white shadow-sm'
                          : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                      }`}
                    >
                      {f.label}
                      <span
                        className={`tabular-nums ${
                          active ? 'text-white/80' : 'text-[#a19f9d]'
                        }`}
                      >
                        {counts[f.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          }
          empty={
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarRange className="h-5 w-5 text-[#a19f9d]" />
              <p className="text-sm font-medium text-[#323130]">
                {cycles.length === 0 ? 'No payroll cycles yet' : 'No matches'}
              </p>
              <p className="max-w-sm text-xs text-[#605e5c]">
                {cycles.length === 0
                  ? 'Create a cycle for the pay period, then generate immutable payslip snapshots.'
                  : 'Try another search or status filter.'}
              </p>
              {cycles.length === 0 ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className={`${btnPrimary} mt-1`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New cycle
                </button>
              ) : null}
            </div>
          }
        />
        {!loading && filteredCycles.length > 0 ? (
          <p className="mt-2 text-[11px] text-[#605e5c]">
            Showing {filteredCycles.length} of {cycles.length} cycles
          </p>
        ) : null}
      </section>

      {selected && selectedCycle ? (
        <section className="mt-8">
          <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold text-[#1b1a19]">
                  Payslip snapshots
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eff6fc] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#0067b8] ring-1 ring-[#c7e0f4]">
                  <FileSpreadsheet className="h-3 w-3" />
                  {selectedCycle.cycleCode}
                </span>
                <span className="inline-flex rounded-full bg-[#f3f2f1] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#605e5c]">
                  {payslips.length}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#605e5c]">
                Frozen employee payslips for this cycle — not live payroll
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedCycle.status !== 'DRAFT' ? (
                <>
                  <button
                    type="button"
                    disabled={!!reportBusy}
                    className={btnSecondary}
                    onClick={() => void runReport('register')}
                  >
                    Register CSV
                  </button>
                  <button
                    type="button"
                    disabled={!!reportBusy}
                    className={btnSecondary}
                    onClick={() => void runReport('statutory')}
                  >
                    Statutory
                  </button>
                  <button
                    type="button"
                    disabled={!!reportBusy}
                    className={btnSecondary}
                    onClick={() => void runReport('loan')}
                  >
                    Loans
                  </button>
                  <button
                    type="button"
                    disabled={!!reportBusy}
                    className={btnSecondary}
                    onClick={() => void runReport('approval')}
                  >
                    Approval trail
                  </button>
                </>
              ) : null}
              {selectedCycle.status === 'APPROVED' ||
              selectedCycle.status === 'PAID' ? (
                <>
                  <button
                    type="button"
                    disabled={!!reportBusy}
                    className={btnSecondary}
                    onClick={() => void runReport('bank')}
                  >
                    Bank file
                  </button>
                  <button
                    type="button"
                    disabled={!!reportBusy}
                    className={btnSecondary}
                    onClick={() => void runReport('mobile')}
                  >
                    Mobile money
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setPayslips([]);
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#605e5c] hover:bg-[#f3f2f1] hover:text-[#323130]"
              >
                <X className="h-3.5 w-3.5" />
                Close
              </button>
            </div>
          </div>

          <PayslipRoster
            rows={payslips}
            onView={(id) => void openPayslipDetail(id)}
            empty={
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <FileSpreadsheet className="h-5 w-5 text-[#a19f9d]" />
                <p className="text-sm font-medium text-[#323130]">
                  No payslips yet
                </p>
                <p className="max-w-sm text-xs text-[#605e5c]">
                  Generate the cycle to freeze employee snapshots for this
                  period.
                </p>
              </div>
            }
          />
          {payslips.length > 0 ? (
            <p className="mt-2 text-[11px] text-[#605e5c]">
              {payslips.length} employee{payslips.length === 1 ? '' : 's'} ·
              total net{' '}
              <span className="font-semibold text-emerald-700">
                {money(selectedNet)}
              </span>
            </p>
          ) : null}
        </section>
      ) : null}

      {detailPayslip ? (
        <Modal
          title="Payslip"
          description={`${detailPayslip.employeeName} · ${detailPayslip.employeeNumber}`}
          onClose={() => setDetailPayslip(null)}
          size="lg"
        >
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Gross</p>
              <p className="text-sm font-semibold tabular-nums">
                {money(detailPayslip.grossPay)}
              </p>
            </div>
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Deductions</p>
              <p className="text-sm font-semibold tabular-nums">
                {money(detailPayslip.totalDeductions)}
              </p>
            </div>
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Net pay</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-700">
                {money(detailPayslip.netPay)}
              </p>
            </div>
          </div>
          {(detailPayslip.calculationResult?.lines?.length ?? 0) > 0 ? (
            <div className="max-h-[320px] overflow-auto rounded border border-[#e1dfdd]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Code</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detailPayslip.calculationResult!.lines!.map((line) => (
                    <tr
                      key={`${line.code}-${line.label}`}
                      className="border-t border-[#edebe9]"
                    >
                      <td className="px-3 py-2 font-mono">{line.code}</td>
                      <td className="px-3 py-2">{line.label}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={line.type} />
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {money(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[#605e5c]">
              Line items appear after generation with the enhanced calculator.
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setDetailPayslip(null)}
              className={btnSecondary}
            >
              Close
            </button>
          </div>
        </Modal>
      ) : null}

      {showCreate ? (
        <Modal
          title="New payroll cycle"
          description="Set the pay period. Snapshots are generated from workforce data in a later step."
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Period start
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className={inputCls}
                  required
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Period end
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className={inputCls}
                  required
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-[#323130]">
              Payroll type
              <select
                value={tenantType}
                onChange={(e) =>
                  setTenantType(
                    e.target.value as
                      | 'INTERNAL_COMPANY'
                      | 'CUSTOMER_MANAGED_PAYROLL',
                  )
                }
                className={inputCls}
              >
                <option value="INTERNAL_COMPANY">Internal company (guards/staff)</option>
                <option value="CUSTOMER_MANAGED_PAYROLL">
                  Customer employee payroll service
                </option>
              </select>
            </label>
            {tenantType === 'CUSTOMER_MANAGED_PAYROLL' ? (
              <label className="block text-sm font-medium text-[#323130]">
                Customer
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-md border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-[13px] text-[#605e5c]">
                Uses workforce employees, guard attendance and company loans —
                separate from customer employee payroll.
              </div>
            )}
            {createError ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {createError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button type="submit" disabled={creating} className={btnPrimary}>
                {creating ? 'Creating…' : 'Create cycle'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
