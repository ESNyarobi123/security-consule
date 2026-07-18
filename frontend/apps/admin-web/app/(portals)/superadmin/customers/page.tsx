'use client';

import { createCustomer, listCustomers, type Customer } from '@pssms/api-client';
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
import { Building2, Contact, UserCheck, UserX } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listCustomers());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.isActive).length;
    const inactive = total - active;
    const withContact = rows.filter((r) => r.email || r.phone).length;
    return { total, active, inactive, withContact };
  }, [rows]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createCustomer({
        code,
        name,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setOpen(false);
      setCode('');
      setName('');
      setEmail('');
      setPhone('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="Register and manage commercial customers"
        actions={
          <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
            New customer
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total customers"
          value={stats.total}
          hint="Registered accounts"
          accent="blue"
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={stats.active}
          hint="Currently enabled"
          accent="emerald"
          icon={<UserCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          hint="Disabled accounts"
          accent="rose"
          icon={<UserX className="h-5 w-5" />}
        />
        <StatCard
          label="With contact"
          value={stats.withContact}
          hint="Email or phone on file"
          accent="violet"
          icon={<Contact className="h-5 w-5" />}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>All customers</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={rows}
          emptyMessage="No customers registered yet."
          columns={[
            {
              key: 'code',
              label: 'Code',
              render: (row) => (
                <span className="font-medium text-[#1b1a19]">{row.code}</span>
              ),
            },
            { key: 'name', label: 'Name' },
            {
              key: 'email',
              label: 'Email',
              render: (row) =>
                row.email ? (
                  <span>{row.email}</span>
                ) : (
                  <span className="text-[#a19f9d]">—</span>
                ),
            },
            {
              key: 'phone',
              label: 'Phone',
              render: (row) =>
                row.phone ? (
                  <span>{row.phone}</span>
                ) : (
                  <span className="text-[#a19f9d]">—</span>
                ),
            },
            {
              key: 'isActive',
              label: 'Status',
              render: (row) => (
                <StatusBadge status={row.isActive ? 'ACTIVE' : 'SUSPENDED'} />
              ),
            },
            {
              key: 'createdAt',
              label: 'Registered',
              render: (row) =>
                new Date(row.createdAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }),
            },
          ]}
        />
      </div>

      {open ? (
        <Modal
          title="New customer"
          description="Register a new commercial customer account."
          onClose={() => setOpen(false)}
        >
          <form onSubmit={onCreate} className="space-y-4">
            <label className="block text-sm font-medium text-[#323130]">
              Code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={inputCls}
                placeholder="e.g. ACME-001"
                required
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Company name"
                required
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Email <span className="font-normal text-[#605e5c]">(optional)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="billing@company.com"
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Phone <span className="font-normal text-[#605e5c]">(optional)</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
                placeholder="+255 700 000 000"
              />
            </label>
            {error ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={submitting}>
                {submitting ? 'Creating…' : 'Create customer'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
