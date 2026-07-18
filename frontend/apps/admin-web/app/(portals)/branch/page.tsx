'use client';

import { listBranches } from '@pssms/api-client';
import {
  DataTable,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
} from '@pssms/ui';
import { Building2, CheckCircle2, MinusCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function BranchPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listBranches>>>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listBranches().then((b) => {
      setRows(b);
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Branch operations"
        description="Branches and field sites master data"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total branches"
          value={stats.total}
          hint="All registered branches"
          icon={<Building2 className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Active branches"
          value={stats.active}
          hint="Currently operational"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Inactive branches"
          value={stats.inactive}
          hint="Disabled or draft sites"
          icon={<MinusCircle className="h-5 w-5" />}
          accent="slate"
        />
      </div>

      <div className="mt-8">
        <SectionTitle>All branches</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={rows}
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            {
              key: 'isActive',
              label: 'Status',
              render: (r) => (
                <StatusBadge status={r.isActive ? 'ACTIVE' : 'DRAFT'} />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
