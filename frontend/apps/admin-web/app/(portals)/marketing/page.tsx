'use client';

import { listCustomers, type Customer } from '@pssms/api-client';
import {
  DataTable,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
  inputCls,
} from '@pssms/ui';
import { Mail, Search, UserCheck, Users, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function MarketingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    void listCustomers()
      .then((rows) => {
        if (active) setCustomers(rows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = customers.length;
    const activeCount = customers.filter((c) => c.isActive).length;
    const withEmail = customers.filter((c) => Boolean(c.email)).length;
    return {
      total,
      active: activeCount,
      inactive: total - activeCount,
      withEmail,
    };
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.code, c.name, c.email ?? '', c.phone ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [customers, query]);

  return (
    <>
      <PageHeader
        title="Marketing"
        description="Customer relationship overview — accounts, reach, and engagement status."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total customers"
          value={stats.total}
          hint="All accounts on record"
          icon={<Users className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Active"
          value={stats.active}
          hint={
            stats.total
              ? `${Math.round((stats.active / stats.total) * 100)}% of base`
              : 'No customers yet'
          }
          icon={<UserCheck className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          hint="Dormant or suspended"
          icon={<UserX className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="With email"
          value={stats.withEmail}
          hint={
            stats.total
              ? `${Math.round((stats.withEmail / stats.total) * 100)}% reachable`
              : 'No contacts captured'
          }
          icon={<Mail className="h-5 w-5" />}
          accent="sky"
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Customer directory</SectionTitle>
        <div className="mb-3 relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8886]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code, name, email, or phone"
            className={`${inputCls} pl-9`}
          />
        </div>
        <DataTable<Customer>
          keyField="id"
          rows={filtered}
          loading={loading}
          emptyMessage={
            query ? 'No customers match your search' : 'No customers found'
          }
          columns={[
            {
              key: 'code',
              label: 'Code',
              render: (row) => (
                <span className="font-mono text-xs text-[#605e5c]">
                  {row.code}
                </span>
              ),
            },
            {
              key: 'name',
              label: 'Name',
              render: (row) => (
                <span className="font-medium text-[#1b1a19]">{row.name}</span>
              ),
            },
            {
              key: 'email',
              label: 'Email',
              render: (row) =>
                row.email ? (
                  <a
                    href={`mailto:${row.email}`}
                    className="text-[#0067b8] hover:underline"
                  >
                    {row.email}
                  </a>
                ) : (
                  <span className="text-[#8a8886]">—</span>
                ),
            },
            {
              key: 'phone',
              label: 'Phone',
              render: (row) =>
                row.phone ? (
                  <span className="text-[#323130]">{row.phone}</span>
                ) : (
                  <span className="text-[#8a8886]">—</span>
                ),
            },
            {
              key: 'isActive',
              label: 'Status',
              render: (row) => (
                <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
