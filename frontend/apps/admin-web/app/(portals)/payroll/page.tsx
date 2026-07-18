'use client';

import {
  approvePayrollCycle,
  createPayrollCycle,
  generatePayrollCycle,
  listPayrollCycles,
  listPayslips,
  markPayrollPaid,
  submitPayrollCycle,
  type PayrollCycle,
  type PayslipSnapshot,
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
  CalendarRange,
  CheckCircle2,
  Loader,
  Lock,
  Plus,
  Wallet,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

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

export default function PayrollPage() {
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [payslips, setPayslips] = useState<PayslipSnapshot[]>([]);
  const [allPayslips, setAllPayslips] = useState<PayslipSnapshot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-cycle modal state
  const [showCreate, setShowCreate] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const user = getSessionUser();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPayrollCycles();
      setCycles(list);
      // Aggregate payslip snapshots across cycles for the net-pay KPI.
      const slipArrays = await Promise.all(
        list.map((c) =>
          listPayslips(c.id).catch(() => [] as PayslipSnapshot[]),
        ),
      );
      setAllPayslips(slipArrays.flat());
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

  async function openPayslips(cycleId: string) {
    setSelected(cycleId);
    setPayslips(await listPayslips(cycleId));
  }

  async function runAction(
    cycle: PayrollCycle,
    action: 'generate' | 'submit' | 'approve' | 'pay',
  ) {
    setError(null);
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
    }
  }

  function openCreate() {
    const d = monthDefaults();
    setPeriodStart(d.start);
    setPeriodEnd(d.end);
    setCreateError(null);
    setShowCreate(true);
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
    setCreating(true);
    setCreateError(null);
    try {
      await createPayrollCycle({
        periodStart,
        periodEnd,
        tenantType: 'INTERNAL_COMPANY',
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

      <div className="mt-8">
        <SectionTitle>Payroll cycles</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={cycles}
          emptyMessage="No payroll cycles yet — create one to get started"
          columns={[
            { key: 'cycleCode', label: 'Cycle' },
            {
              key: 'periodStart',
              label: 'Period',
              render: (r) =>
                `${String(r.periodStart).slice(0, 10)} → ${String(r.periodEnd).slice(0, 10)}`,
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: 'createdAt',
              label: 'Created',
              render: (r) => String(r.createdAt).slice(0, 10),
            },
            {
              key: 'id',
              label: 'Actions',
              render: (r) => (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="text-[#0067b8] hover:underline text-xs font-medium"
                    onClick={() => void openPayslips(r.id)}
                  >
                    Payslips
                  </button>
                  {r.status === 'DRAFT' ? (
                    <button
                      type="button"
                      className="text-[#0067b8] hover:underline text-xs font-medium"
                      onClick={() => void runAction(r, 'generate')}
                    >
                      Generate
                    </button>
                  ) : null}
                  {r.status === 'CALCULATED' ? (
                    <button
                      type="button"
                      className="text-[#0067b8] hover:underline text-xs font-medium"
                      onClick={() => void runAction(r, 'submit')}
                    >
                      Submit
                    </button>
                  ) : null}
                  {r.status === 'PENDING_APPROVAL' ? (
                    <button
                      type="button"
                      className="text-[#0067b8] hover:underline text-xs font-medium"
                      onClick={() => void runAction(r, 'approve')}
                    >
                      Approve
                    </button>
                  ) : null}
                  {r.status === 'APPROVED' ? (
                    <button
                      type="button"
                      className="text-[#0067b8] hover:underline text-xs font-medium"
                      onClick={() => void runAction(r, 'pay')}
                    >
                      Mark paid
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </div>

      {selected ? (
        <div className="mt-8">
          <SectionTitle>
            {selectedCycle
              ? `Payslip snapshots · ${selectedCycle.cycleCode}`
              : 'Payslip snapshots'}
          </SectionTitle>
          <DataTable
            keyField="id"
            rows={payslips}
            emptyMessage="No payslips — generate the cycle first"
            columns={[
              { key: 'employeeNumber', label: 'Emp #' },
              { key: 'employeeName', label: 'Name' },
              {
                key: 'grossPay',
                label: 'Gross',
                render: (r) => money(r.grossPay),
              },
              {
                key: 'totalDeductions',
                label: 'Deductions',
                render: (r) => money(r.totalDeductions),
              },
              {
                key: 'netPay',
                label: 'Net',
                render: (r) => (
                  <span className="font-medium text-[#1b1a19]">
                    {money(r.netPay)}
                  </span>
                ),
              },
            ]}
          />
          {payslips.length > 0 ? (
            <p className="mt-2 text-xs text-[#605e5c]">
              {payslips.length} employee{payslips.length === 1 ? '' : 's'} ·
              total net {money(selectedNet)}
            </p>
          ) : null}
        </div>
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
            <div className="rounded-md border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-[13px] text-[#605e5c]">
              Tenant type: <span className="font-medium text-[#323130]">Internal company</span>
            </div>
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
