'use client';

import {
  getCustomerPayrollPayslip,
  listCustomerPayrollCycles,
  listCustomerPayrollDueAlerts,
  listCustomerPayrollPayslips,
  type CustomerPayrollCycle,
  type CustomerPayrollDueAlert,
  type CustomerPayslip,
} from '@pssms/api-client';
import { ChevronRight, RefreshCw, Wallet, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalStat,
  PortalToolbar,
  StatusPill,
  formatDate,
  money,
} from '../../_components/portal-ui';

export default function CustomerPayrollPage() {
  const [cycles, setCycles] = useState<CustomerPayrollCycle[]>([]);
  const [payslips, setPayslips] = useState<CustomerPayslip[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerPayslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [payslipsLoading, setPayslipsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dueAlerts, setDueAlerts] = useState<CustomerPayrollDueAlert[]>([]);

  const loadCycles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, alerts] = await Promise.all([
        listCustomerPayrollCycles(),
        listCustomerPayrollDueAlerts().catch(() => [] as CustomerPayrollDueAlert[]),
      ]);
      setCycles(list);
      setDueAlerts(alerts);
      if (list.length > 0 && !selectedCycleId) {
        setSelectedCycleId(list[0]!.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payroll');
    } finally {
      setLoading(false);
    }
  }, [selectedCycleId]);

  const loadPayslips = useCallback(async (cycleId: string) => {
    setPayslipsLoading(true);
    try {
      setPayslips(await listCustomerPayrollPayslips(cycleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payslips');
      setPayslips([]);
    } finally {
      setPayslipsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCycles();
  }, [loadCycles]);

  useEffect(() => {
    if (selectedCycleId) void loadPayslips(selectedCycleId);
  }, [selectedCycleId, loadPayslips]);

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payslips;
    return payslips.filter(
      (p) =>
        p.employeeName.toLowerCase().includes(q) ||
        p.employeeNumber.toLowerCase().includes(q),
    );
  }, [payslips, search]);

  const totalNet = payslips.reduce((s, p) => s + (p.netPay ?? 0), 0);

  async function openDetail(p: CustomerPayslip) {
    try {
      setDetail(await getCustomerPayrollPayslip(p.id));
    } catch {
      setDetail(p);
    }
  }

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Finance · Customer payroll service"
        title="Employee payroll"
        subtitle="Payroll for your registered employees — calculated separately from HIGHLINK guard payroll. You see only your organisation's cycles and payslips."
        actions={
          <button
            type="button"
            onClick={() => void loadCycles()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      {dueAlerts.length > 0 ? (
        <div className="mb-4 rounded-xl border border-[#c7e0f4] bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-[#323130]">
            Payroll due (invoice paid)
          </h2>
          <ul className="space-y-2 text-sm">
            {dueAlerts.map((a) => (
              <li key={a.id} className="rounded-lg bg-[#faf9f8] px-3 py-2">
                <p className="font-medium">
                  {a.payrollMonth} · invoice {a.invoiceNumber ?? '—'}
                </p>
                <p className="text-xs text-[#605e5c]">
                  Paid {money(a.invoiceAmountPaid, a.currency)} ·{' '}
                  {a.employeesCovered} employees · due {formatDate(a.dueDate)} ·
                  portion {money(a.payrollPortionDue, a.currency)} · approval{' '}
                  {a.payrollApprovalStatus} · {a.responsibleOfficerName ?? 'Payroll'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <PortalStat
          label="Payroll cycles"
          value={loading ? '—' : cycles.length}
          tone="blue"
        />
        <PortalStat
          label="Employees in cycle"
          value={payslipsLoading ? '—' : payslips.length}
          tone="teal"
        />
        <PortalStat
          label="Total net (selected)"
          value={payslipsLoading ? '—' : money(totalNet, 'TZS')}
          tone="emerald"
        />
      </div>

      {cycles.length === 0 && !loading ? (
        <PortalEmpty
          title="No payroll cycles yet"
          description="When HIGHLINK runs customer-managed payroll for your employees, cycles and payslips will appear here."
          icon={<Wallet className="h-4 w-4" />}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {cycles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCycleId(c.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                  selectedCycleId === c.id
                    ? 'bg-[#0078d4] text-white ring-[#0078d4]'
                    : 'bg-white text-[#323130] ring-[#e1dfdd] hover:bg-[#faf9f8]'
                }`}
              >
                {c.cycleCode}{' '}
                <StatusPill status={c.status} />
              </button>
            ))}
          </div>

          {selectedCycle ? (
            <p className="mb-3 text-sm text-[#605e5c]">
              Period {formatDate(selectedCycle.periodStart)} —{' '}
              {formatDate(selectedCycle.periodEnd)} · immutable snapshots (not
              live attendance)
            </p>
          ) : null}

          <PortalToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search employee…"
          />

          {payslipsLoading && payslips.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl bg-[#edebe9]"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <PortalEmpty
              title="No payslips in this cycle"
              description="Employees need salary assignments and access attendance in the period before generation."
              icon={<Wallet className="h-4 w-4" />}
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => void openDetail(p)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#e1dfdd] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#0078d4]/40"
                  >
                    <div>
                      <p className="font-semibold text-[#323130]">
                        {p.employeeName}
                      </p>
                      <p className="text-xs text-[#605e5c]">
                        {p.employeeNumber} · {formatDate(p.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#107c10]">
                          {money(p.netPay, 'TZS')}
                        </p>
                        <p className="text-xs text-[#605e5c]">
                          Gross {money(p.grossPay, 'TZS')}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#605e5c]" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <PortalDeferral note="HIGHLINK processes disbursement after your payroll-service invoice is fully paid. Unpaid, partial, overdue or disputed invoices block payment unless management grants an exception. Payslip PDF deferred." />

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#323130]">
                  {detail.employeeName}
                </h2>
                <p className="text-sm text-[#605e5c]">{detail.employeeNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg p-1 text-[#605e5c] hover:bg-[#f3f2f1]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[#faf9f8] p-2">
                <p className="text-xs text-[#605e5c]">Gross</p>
                <p className="font-semibold">{money(detail.grossPay, 'TZS')}</p>
              </div>
              <div className="rounded-lg bg-[#faf9f8] p-2">
                <p className="text-xs text-[#605e5c]">Deductions</p>
                <p className="font-semibold">
                  {money(detail.totalDeductions, 'TZS')}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2">
                <p className="text-xs text-emerald-800">Net pay</p>
                <p className="font-semibold text-emerald-900">
                  {money(detail.netPay, 'TZS')}
                </p>
              </div>
            </div>
            {detail.calculationResult?.lines?.length ? (
              <ul className="space-y-1 text-sm">
                {detail.calculationResult.lines.map((line) => (
                  <li
                    key={`${line.code}-${line.type}`}
                    className="flex justify-between border-b border-[#edebe9] py-1.5"
                  >
                    <span className="text-[#605e5c]">{line.label}</span>
                    <span
                      className={
                        line.type === 'DEDUCTION'
                          ? 'text-rose-700'
                          : 'text-[#323130]'
                      }
                    >
                      {line.type === 'DEDUCTION' ? '−' : '+'}
                      {money(line.amount, 'TZS')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#605e5c]">
                Line breakdown available after cycle generation.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
