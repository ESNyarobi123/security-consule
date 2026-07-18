'use client';

import {
  createContract,
  listContracts,
  listCustomers,
  updateContractStatus,
  type Contract,
  type Customer,
} from '@pssms/api-client';
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
  CheckCircle2,
  FileClock,
  FileText,
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

const SERVICE_TYPES = [
  'SECURITY_GUARD',
  'CCTV_MONITORING',
  'MOBILE_PATROL',
  'EVENT_SECURITY',
  'RISK_CONSULTING',
];

const fmtMoney = (n: number, currency = 'TZS') =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);

type ContractForm = {
  customerId: string;
  contractNumber: string;
  title: string;
  serviceType: string;
  startDate: string;
  endDate: string;
  monthlyFee: string;
};

const emptyForm: ContractForm = {
  customerId: '',
  contractNumber: '',
  title: '',
  serviceType: 'SECURITY_GUARD',
  startDate: '',
  endDate: '',
  monthlyFee: '',
};

export default function ContractsPage() {
  const [rows, setRows] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ContractForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contracts, custs] = await Promise.all([
        listContracts(),
        listCustomers(),
      ]);
      setRows(contracts);
      setCustomers(custs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── KPIs derived from real fetched data ──
  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === 'ACTIVE');
    const drafts = rows.filter((r) => r.status === 'DRAFT');
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
      totalMonthly,
      activeMonthly,
      currency,
    };
  }, [rows]);

  const customerName = useCallback(
    (id: string) => customers.find((c) => c.id === id)?.name ?? '—',
    [customers],
  );

  function openCreate() {
    const n = Date.now().toString().slice(-6);
    setForm({
      customerId: customers[0]?.id ?? '',
      contractNumber: `CTR-${n}`,
      title: 'Manned guarding services',
      serviceType: 'SECURITY_GUARD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      monthlyFee: '4500000',
    });
    setError(null);
    setOpen(true);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.customerId) {
      setError('Select a customer first.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createContract({
        customerId: form.customerId,
        contractNumber: form.contractNumber,
        title: form.title,
        serviceType: form.serviceType,
        startDate: form.startDate,
        endDate: form.endDate,
        monthlyFee: Number(form.monthlyFee),
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
    await updateContractStatus(id, status);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Contracts"
        description="Commercial agreements — draft to active lifecycle"
        actions={
          <button type="button" onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" />
            New contract
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Drafts"
          value={stats.draftCount}
          hint="Awaiting activation"
          icon={<FileClock className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Monthly value"
          value={fmtMoney(stats.totalMonthly, stats.currency)}
          hint={`${fmtMoney(stats.activeMonthly, stats.currency)} active MRR`}
          icon={<Wallet className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      <div className="mt-8">
        <SectionTitle>All contracts</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={rows}
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
              label: 'Service',
              render: (r) => r.serviceType.replace(/_/g, ' '),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
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
                if (r.status === 'DRAFT') {
                  return (
                    <button
                      type="button"
                      onClick={() => void setStatus(r.id, 'ACTIVE')}
                      className="text-[#0067b8] hover:underline text-xs font-medium"
                    >
                      Activate
                    </button>
                  );
                }
                if (r.status === 'ACTIVE') {
                  return (
                    <button
                      type="button"
                      onClick={() => void setStatus(r.id, 'SUSPENDED')}
                      className="text-[#0067b8] hover:underline text-xs font-medium"
                    >
                      Suspend
                    </button>
                  );
                }
                if (r.status === 'SUSPENDED') {
                  return (
                    <button
                      type="button"
                      onClick={() => void setStatus(r.id, 'ACTIVE')}
                      className="text-[#0067b8] hover:underline text-xs font-medium"
                    >
                      Reactivate
                    </button>
                  );
                }
                return <span className="text-[#605e5c]">—</span>;
              },
            },
          ]}
        />
      </div>

      {open ? (
        <Modal
          title="New contract"
          description="Register a commercial agreement for a customer"
          onClose={() => setOpen(false)}
          size="lg"
        >
          <form onSubmit={onCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Customer
                <select
                  value={form.customerId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerId: e.target.value }))
                  }
                  className={inputCls}
                  required
                >
                  <option value="" disabled>
                    {customers.length ? 'Select customer' : 'No customers found'}
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
                    setForm((f) => ({ ...f, contractNumber: e.target.value }))
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

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Service type
                <select
                  value={form.serviceType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, serviceType: e.target.value }))
                  }
                  className={inputCls}
                >
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Monthly fee ({stats.currency})
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

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
                disabled={saving || !form.customerId}
                className={btnPrimary}
              >
                {saving ? 'Creating…' : 'Create contract'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
