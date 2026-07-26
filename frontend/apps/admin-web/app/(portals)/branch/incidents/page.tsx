'use client';

import {
  createIncident,
  listIncidents,
  listSites,
  updateIncidentStatus,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
  type Site,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, formatDateTime, shortId } from '../_components/shared';

const CATEGORIES = [
  'SECURITY_BREACH',
  'THEFT',
  'MISCONDUCT',
  'FAKE_CODE',
  'PARKING',
  'EQUIPMENT',
  'OTHER',
] as const;

const SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** Next allowed status for thin escalate path (matches API). */
function nextStatuses(current: IncidentStatus): IncidentStatus[] {
  switch (current) {
    case 'OPEN':
      return ['INVESTIGATING'];
    case 'INVESTIGATING':
      return ['RESOLVED'];
    case 'RESOLVED':
      return ['CLOSED'];
    default:
      return [];
  }
}

export default function BranchIncidentsPage() {
  const [rows, setRows] = useState<Incident[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusRow, setStatusRow] = useState<Incident | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incidents, s] = await Promise.all([
        listIncidents(siteId ? { siteId } : undefined),
        listSites(),
      ]);
      setRows(incidents);
      setSites(s);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const siteLabel = (row: Incident) => {
    if (row.siteCode) {
      return row.siteName
        ? `${row.siteCode} — ${row.siteName}`
        : row.siteCode;
    }
    const s = sites.find((x) => x.id === row.siteId);
    return s ? `${s.code} — ${s.name}` : shortId(row.siteId);
  };

  async function onAdvance(row: Incident, status: IncidentStatus) {
    setUpdatingId(row.id);
    setActionError(null);
    try {
      await updateIncidentStatus(row.id, { status });
      setStatusRow(null);
      await refresh();
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <BranchShell
      title="Incidents"
      description="Report and escalate site incidents (OPEN → INVESTIGATING → RESOLVED → CLOSED). Full Employment→CEO matrix, risk register, and CCTV links are deferred."
      actions={
        <>
          <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
            Site
            <select
              className={`${inputCls} !w-auto min-w-[160px]`}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className={btnSecondary}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className={btnPrimary}
            disabled={sites.length === 0}
          >
            <Plus className="h-3.5 w-3.5" />
            Report incident
          </button>
        </>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          {actionError}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {rows.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
            <AlertTriangle className="h-5 w-5 text-[#a19f9d]" />
            <p>No incidents yet</p>
          </div>
        ) : (
          <DataTable<Incident>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No incidents"
            columns={[
              {
                key: 'incidentNumber',
                label: 'Number',
                render: (r) => (
                  <span className="font-mono text-sm">{r.incidentNumber}</span>
                ),
              },
              {
                key: 'siteId',
                label: 'Site',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">{siteLabel(r)}</span>
                ),
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
                key: 'title',
                label: 'Title',
                render: (r) => (
                  <div className="max-w-[220px]">
                    <p className="truncate text-sm text-[#323130]">{r.title}</p>
                    <p className="truncate text-[11px] text-[#a19f9d]">
                      {r.category}
                    </p>
                  </div>
                ),
              },
              {
                key: 'createdAt',
                label: 'Created',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">
                    {formatDateTime(r.createdAt)}
                  </span>
                ),
              },
              {
                key: 'id',
                label: '',
                render: (r) => {
                  const next = nextStatuses(r.status);
                  if (next.length === 0) {
                    return (
                      <span className="text-[11px] text-[#a19f9d]">Closed</span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={updatingId === r.id}
                      onClick={() => {
                        setActionError(null);
                        setStatusRow(r);
                      }}
                    >
                      Update status
                    </button>
                  );
                },
              },
            ]}
          />
        )}
      </GlassCard>

      {createOpen ? (
        <CreateIncidentModal
          sites={sites}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {statusRow ? (
        <Modal
          title={`Update ${statusRow.incidentNumber}`}
          onClose={() => setStatusRow(null)}
        >
          <p className="mb-3 text-xs text-[#605e5c]">
            Current: <StatusBadge status={statusRow.status} /> — advance along
            OPEN → INVESTIGATING → RESOLVED → CLOSED.
          </p>
          <div className="flex flex-wrap gap-2">
            {nextStatuses(statusRow.status).map((s) => (
              <button
                key={s}
                type="button"
                className={btnPrimary}
                disabled={updatingId === statusRow.id}
                onClick={() => void onAdvance(statusRow, s)}
              >
                Mark {s}
              </button>
            ))}
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setStatusRow(null)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </BranchShell>
  );
}

function CreateIncidentModal({
  sites,
  onClose,
  onCreated,
}: {
  sites: Site[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!siteId || !title.trim() || !description.trim()) {
      setFormError('Site, title, and description are required');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createIncident({
        siteId,
        category,
        severity,
        title: title.trim(),
        description: description.trim(),
      });
      await onCreated();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Report incident" onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {formError ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            {formError}
          </p>
        ) : null}
        <label className="block text-xs font-medium text-[#605e5c]">
          Site
          <select
            className={`${inputCls} mt-1`}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            required
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Category
            <select
              className={`${inputCls} mt-1`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Severity
            <select
              className={`${inputCls} mt-1`}
              value={severity}
              onChange={(e) =>
                setSeverity(e.target.value as IncidentSeverity)
              }
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs font-medium text-[#605e5c]">
          Title
          <input
            className={`${inputCls} mt-1`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
        </label>
        <label className="block text-xs font-medium text-[#605e5c]">
          Description
          <textarea
            className={`${inputCls} mt-1 min-h-[88px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
