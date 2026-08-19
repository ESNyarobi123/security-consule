'use client';

import {
  createRisk,
  getRiskOptions,
  listRisks,
  updateRisk,
  type CatalogOption,
  type RiskRegisterItem,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import {
  DataTable,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplianceShell } from '../_components/ComplianceShell';
import { formatApiError } from '../_components/shared';

export default function ComplianceRisksPage() {
  const sessionUser = useMemo(() => getSessionUser(), []);
  const canMutate =
    can(sessionUser, 'compliance.manage') || can(sessionUser, 'dpo.manage');
  const [rows, setRows] = useState<RiskRegisterItem[]>([]);
  const [cats, setCats] = useState<CatalogOption[]>([]);
  const [frames, setFrames] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('DATA_PROTECTION');
  const [severity, setSeverity] = useState('HIGH');
  const [regulatoryRef, setRegulatoryRef] = useState('PDPA_TANZANIA');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, opts] = await Promise.all([listRisks(), getRiskOptions()]);
      setRows(list);
      setCats(opts.categories);
      setFrames(opts.frameworks);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ComplianceShell
      title="Risk register"
      description="Thin §32 register with regulatory references. Not a DPIA / residual-risk scoring engine. Recorder cannot close their own row."
      actions={
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {canMutate ? (
        <div className="mb-4 grid gap-2 rounded-md border border-[#e1dfdd] p-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            className={inputCls + ' mt-0'}
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className={inputCls + ' mt-0'}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {cats.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className={inputCls + ' mt-0'}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className={inputCls + ' mt-0'}
            value={regulatoryRef}
            onChange={(e) => setRegulatoryRef(e.target.value)}
          >
            {frames.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            className={inputCls + ' mt-0 md:col-span-2'}
            placeholder="Description (min 10 chars)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || title.length < 3 || description.length < 10}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  await createRisk({
                    title,
                    description,
                    category,
                    severity,
                    regulatoryRef,
                  });
                  setTitle('');
                  setDescription('');
                  await load();
                } catch (e) {
                  setError(formatApiError(e));
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Record risk
          </button>
        </div>
      ) : (
        <p className="mb-3 text-xs text-[#605e5c]">
          Legal / Auditor: read-only. Mutate needs compliance.manage or dpo.manage.
        </p>
      )}
      <DataTable
        loading={loading}
        keyField="id"
        rows={rows}
        emptyMessage="No risks recorded"
        columns={[
          { key: 'referenceCode', label: 'Ref' },
          { key: 'title', label: 'Title' },
          {
            key: 'category',
            label: 'Category',
            render: (r) => r.category.replace(/_/g, ' '),
          },
          {
            key: 'regulatoryRef',
            label: 'Regulatory',
            render: (r) => r.regulatoryRef?.replace(/_/g, ' ') ?? '—',
          },
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => <StatusBadge status={r.severity} />,
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'id',
            label: 'Actions',
            render: (r) =>
              canMutate ? (
                <div className="flex flex-wrap gap-2">
                  {r.allowedNextStatuses.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="text-xs font-medium text-[#0067b8] hover:underline"
                      onClick={() =>
                        void updateRisk(r.id, { status: s })
                          .then(() => load())
                          .catch((e) => setError(formatApiError(e)))
                      }
                    >
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </ComplianceShell>
  );
}
