'use client';

import {
  createIncident,
  getDocumentDownloadUrl,
  listDocuments,
  listIncidentCategoryOptions,
  listIncidentOfficerOptions,
  listIncidents,
  listSites,
  updateIncidentStatus,
  uploadDocument,
  type DocumentObject,
  type Incident,
  type IncidentCategoryOption,
  type IncidentOfficerOption,
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
import {
  AlertTriangle,
  Eye,
  FileText,
  Paperclip,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, formatDateTime, shortId } from '../_components/shared';

const FALLBACK_CATEGORIES: IncidentCategoryOption[] = [
  { value: 'SECURITY_BREACH', label: 'Security breach' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'VISITOR_ISSUE', label: 'Visitor issue' },
  { value: 'FAKE_VERIFICATION_CODE', label: 'Fake verification code' },
  { value: 'GUARD_MISCONDUCT', label: 'Guard misconduct' },
  { value: 'CUSTOMER_COMPLAINT', label: 'Customer complaint' },
  { value: 'PARKING_INCIDENT', label: 'Parking incident' },
  { value: 'VEHICLE_INCIDENT', label: 'Vehicle incident' },
  {
    value: 'UNAUTHORIZED_VEHICLE_ACCESS',
    label: 'Unauthorized vehicle access',
  },
  { value: 'PARKING_VIOLATION', label: 'Parking violation' },
  { value: 'PAYROLL_DISPUTE', label: 'Payroll dispute' },
  { value: 'SUPPLIER_DISPUTE', label: 'Supplier dispute' },
  { value: 'SYSTEM_FAILURE', label: 'System failure' },
  { value: 'ACCIDENT', label: 'Accident' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'EQUIPMENT_FAILURE', label: 'Equipment failure' },
  { value: 'DATA_BREACH', label: 'Data breach' },
  { value: 'OTHER', label: 'Other' },
];

const SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** Fallback when API omits allowedNextStatuses (older core-api). */
function nextStatusesFallback(current: IncidentStatus): IncidentStatus[] {
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

function nextForRow(r: Incident): IncidentStatus[] {
  if (r.allowedNextStatuses) return r.allowedNextStatuses;
  return nextStatusesFallback(r.status);
}

export default function BranchIncidentsPage() {
  const [rows, setRows] = useState<Incident[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] =
    useState<IncidentCategoryOption[]>(FALLBACK_CATEGORIES);
  const [officers, setOfficers] = useState<IncidentOfficerOption[]>([]);
  const [siteId, setSiteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusRow, setStatusRow] = useState<Incident | null>(null);
  const [detailRow, setDetailRow] = useState<Incident | null>(null);
  const [evidenceRow, setEvidenceRow] = useState<Incident | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incidents, s, categoryRows, officerRows] = await Promise.all([
        listIncidents(siteId ? { siteId } : undefined),
        listSites(),
        listIncidentCategoryOptions().catch(() => FALLBACK_CATEGORIES),
        listIncidentOfficerOptions().catch(() => []),
      ]);
      setRows(incidents);
      setSites(s);
      setCategories(
        categoryRows.length > 0 ? categoryRows : FALLBACK_CATEGORIES,
      );
      setOfficers(officerRows);
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

  return (
    <BranchShell
      title="Incidents"
      description="Record, investigate, resolve, and approve closure with responsible officers, evidence, action history, site scope, and reporter≠closer separation of duties."
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
                key: 'reporterId',
                label: 'Reporter / responsible',
                render: (r) => (
                  <div className="max-w-[180px] text-xs">
                    <p className="truncate text-[#323130]">
                      {r.reporterName || shortId(r.reporterId)}
                    </p>
                    <p className="truncate text-[11px] text-[#605e5c]">
                      Owner: {r.assignedToName || 'Unassigned'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'createdAt',
                label: 'Occurred',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">
                    {formatDateTime(r.occurredAt || r.createdAt)}
                  </span>
                ),
              },
              {
                key: 'id',
                label: 'Next',
                render: (r) => {
                  const next = nextForRow(r);
                  return (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0078d4] hover:underline"
                        onClick={() => setDetailRow(r)}
                      >
                        <Eye className="h-3 w-3" /> Detail
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0078d4] hover:underline"
                        onClick={() => setEvidenceRow(r)}
                      >
                        <Paperclip className="h-3 w-3" /> Evidence
                      </button>
                      {r.status !== 'CLOSED' && next.length > 0 ? (
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => {
                            setActionError(null);
                            setStatusRow(r);
                          }}
                        >
                          Update
                        </button>
                      ) : null}
                      {r.status !== 'CLOSED' && next.length === 0 ? (
                        <span
                          className="max-w-[140px] text-[11px] text-amber-800"
                          title={r.requiredRoleHint}
                        >
                          {r.blockedReason ?? 'Blocked'}
                        </span>
                      ) : null}
                    </div>
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
          categories={categories}
          officers={officers}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {statusRow ? (
        <UpdateIncidentModal
          incident={statusRow}
          officers={officers}
          onClose={() => setStatusRow(null)}
          onUpdated={async () => {
            setStatusRow(null);
            await refresh();
          }}
        />
      ) : null}

      {detailRow ? (
        <IncidentDetailModal
          incident={detailRow}
          onClose={() => setDetailRow(null)}
        />
      ) : null}

      {evidenceRow ? (
        <IncidentEvidenceModal
          incident={evidenceRow}
          onClose={() => setEvidenceRow(null)}
        />
      ) : null}
    </BranchShell>
  );
}

function CreateIncidentModal({
  sites,
  categories,
  officers,
  onClose,
  onCreated,
}: {
  sites: Site[];
  categories: IncidentCategoryOption[];
  officers: IncidentOfficerOption[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [category, setCategory] = useState<string>(
    categories[0]?.value ?? 'SECURITY_BREACH',
  );
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [occurredAt, setOccurredAt] = useState(
    new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16),
  );
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
        locationDescription: locationDescription.trim() || undefined,
        assignedTo: assignedTo || undefined,
        occurredAt: new Date(occurredAt).toISOString(),
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
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Occurred at
            <input
              type="datetime-local"
              className={`${inputCls} mt-1`}
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Responsible officer
            <select
              className={`${inputCls} mt-1`}
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {officers.map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs font-medium text-[#605e5c]">
          Location within site
          <input
            className={`${inputCls} mt-1`}
            value={locationDescription}
            onChange={(e) => setLocationDescription(e.target.value)}
            maxLength={300}
            placeholder="Gate 2, north perimeter, warehouse bay…"
          />
        </label>
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

function UpdateIncidentModal({
  incident,
  officers,
  onClose,
  onUpdated,
}: {
  incident: Incident;
  officers: IncidentOfficerOption[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const next = nextForRow(incident);
  const [status, setStatus] = useState<IncidentStatus>(
    next[0] ?? incident.status,
  );
  const [assignedTo, setAssignedTo] = useState(incident.assignedTo ?? '');
  const [actionTaken, setActionTaken] = useState(incident.actionTaken ?? '');
  const [resolution, setResolution] = useState(incident.resolution ?? '');
  const [closureApprovalNote, setClosureApprovalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'RESOLVED' && !resolution.trim()) {
      setError('Resolution is required before resolving the incident');
      return;
    }
    if (status === 'CLOSED' && !closureApprovalNote.trim()) {
      setError('Closure approval note is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateIncidentStatus(incident.id, {
        status,
        assignedTo: assignedTo || null,
        actionTaken: actionTaken.trim() || undefined,
        resolution: resolution.trim() || undefined,
        closureApprovalNote: closureApprovalNote.trim() || undefined,
      });
      await onUpdated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Update ${incident.incidentNumber}`} onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <p className="text-xs text-[#605e5c]">
          Current: <StatusBadge status={incident.status} />{' '}
          <StatusBadge status={incident.severity} />. Resolution and closure are
          role-gated; the reporter cannot resolve or close their own case.
        </p>
        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            {error}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Next status
            <select
              className={`${inputCls} mt-1`}
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus)}
            >
              {next.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Responsible officer
            <select
              className={`${inputCls} mt-1`}
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {officers.map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs font-medium text-[#605e5c]">
          Action taken
          <textarea
            className={`${inputCls} mt-1 min-h-[72px]`}
            value={actionTaken}
            onChange={(e) => setActionTaken(e.target.value)}
            placeholder="Containment, notifications, investigation steps…"
          />
        </label>
        {status === 'RESOLVED' || status === 'CLOSED' ? (
          <label className="block text-xs font-medium text-[#605e5c]">
            Resolution
            <textarea
              className={`${inputCls} mt-1 min-h-[72px]`}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              required
            />
          </label>
        ) : null}
        {status === 'CLOSED' ? (
          <>
            <div className="rounded border border-[#c7e0f4] bg-[#eff6fc] px-3 py-2 text-xs text-[#004578]">
              Closing records your user ID and timestamp as the authorized
              closure approval. CRITICAL incidents require GM/CEO authority.
            </div>
            <label className="block text-xs font-medium text-[#605e5c]">
              Closure approval note
              <textarea
                className={`${inputCls} mt-1 min-h-[72px]`}
                value={closureApprovalNote}
                onChange={(e) => setClosureApprovalNote(e.target.value)}
                required
              />
            </label>
          </>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : `Mark ${status}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function IncidentDetailModal({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const rows = [
    ['Incident number', incident.incidentNumber],
    ['Occurred', formatDateTime(incident.occurredAt || incident.createdAt)],
    ['Location', incident.locationDescription || incident.siteName || incident.siteCode || '—'],
    ['Category', incident.category],
    ['Severity', incident.severity],
    ['Reporter', incident.reporterName || shortId(incident.reporterId)],
    ['Responsible officer', incident.assignedToName || 'Unassigned'],
    ['Action taken', incident.actionTaken || 'Not recorded'],
    ['Resolution', incident.resolution || 'Not resolved'],
    ['Resolved by', incident.resolvedByName || '—'],
    [
      'Closure approval',
      incident.closedAt
        ? `${incident.closedByName || shortId(incident.closedBy || '')} · ${formatDateTime(incident.closedAt)}`
        : 'Pending',
    ],
    ['Closure note', incident.closureApprovalNote || '—'],
  ];
  return (
    <Modal title={incident.incidentNumber} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <StatusBadge status={incident.status} />
          <StatusBadge status={incident.severity} />
          <StatusBadge status={incident.category} />
        </div>
        <div>
          <h3 className="font-semibold text-[#323130]">{incident.title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[#605e5c]">
            {incident.description}
          </p>
        </div>
        <dl className="divide-y divide-[#edebe9] rounded border border-[#edebe9]">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 px-3 py-2 sm:grid-cols-3">
              <dt className="text-xs font-medium text-[#605e5c]">{label}</dt>
              <dd className="whitespace-pre-wrap text-sm text-[#323130] sm:col-span-2">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function IncidentEvidenceModal({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const [documents, setDocuments] = useState<DocumentObject[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDocuments(
        await listDocuments({
          resourceType: 'Incident',
          resourceId: incident.id,
        }),
      );
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [incident.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await uploadDocument({
        file,
        resourceType: 'Incident',
        resourceId: incident.id,
      });
      setFile(null);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDownload(document: DocumentObject) {
    try {
      const { url } = await getDocumentDownloadUrl(document.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <Modal title={`Evidence · ${incident.incidentNumber}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-[#605e5c]">
          Org- and site-scoped evidence. PDF, PNG, JPEG, or WebP; maximum 10 MB.
        </p>
        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            {error}
          </p>
        ) : null}
        <form onSubmit={(e) => void onUpload(e)} className="flex items-end gap-2">
          <label className="block flex-1 text-xs font-medium text-[#605e5c]">
            Evidence file
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className={`${inputCls} mt-1`}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="submit"
            className={btnPrimary}
            disabled={!file || saving}
          >
            {saving ? 'Uploading…' : 'Upload'}
          </button>
        </form>
        {loading ? (
          <p className="text-xs text-[#605e5c]">Loading evidence…</p>
        ) : documents.length === 0 ? (
          <p className="text-xs text-[#605e5c]">No evidence attached.</p>
        ) : (
          <ul className="divide-y divide-[#edebe9] rounded border border-[#edebe9]">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-sm font-medium">
                    <FileText className="h-3.5 w-3.5" />
                    {document.fileName}
                  </p>
                  <p className="text-[11px] text-[#605e5c]">
                    {formatBytes(document.sizeBytes)} ·{' '}
                    {formatDateTime(document.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-[#0078d4] hover:underline"
                  onClick={() => void onDownload(document)}
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
