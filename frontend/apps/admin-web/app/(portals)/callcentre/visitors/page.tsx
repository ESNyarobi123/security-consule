'use client';

import {
  approveVisitorAppointment,
  getDocumentDownloadUrl,
  listDocuments,
  listVisitorAppointments,
  listVisitorEntries,
  rejectVisitorAppointment,
  uploadDocument,
  type DocumentObject,
  type GateCodeDelivery,
  type VisitorAppointment,
  type VisitorEntry,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
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
  CalendarClock,
  CheckCircle2,
  Clock,
  DoorOpen,
  KeyRound,
  Paperclip,
  RefreshCw,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDocError(err: unknown): string {
  if (!(err instanceof Error)) return 'Request failed';
  const msg = err.message;
  try {
    const parsed = JSON.parse(msg) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    /* plain text */
  }
  return msg.slice(0, 280);
}

export default function CallCentreVisitorsPage() {
  const sessionUser = useMemo(() => getSessionUser(), []);
  const canUploadIdScan =
    can(sessionUser, 'documents.manage') && can(sessionUser, 'visitors.manage');
  const [appointments, setAppointments] = useState<VisitorAppointment[]>([]);
  const [entries, setEntries] = useState<VisitorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeModal, setCodeModal] = useState<{
    code: string;
    delivery?: GateCodeDelivery;
  } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<VisitorAppointment | null>(
    null,
  );
  const [docsTarget, setDocsTarget] = useState<VisitorAppointment | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, e] = await Promise.all([
        listVisitorAppointments(),
        listVisitorEntries(),
      ]);
      setAppointments(a);
      setEntries(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const pending = appointments.filter((a) => a.status === 'PENDING').length;
    const approved = appointments.filter((a) => a.status === 'APPROVED').length;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const entriesToday = entries.filter(
      (e) => new Date(e.recordedAt) >= startOfDay,
    ).length;
    return {
      total: appointments.length,
      pending,
      approved,
      entriesToday,
      entriesTotal: entries.length,
    };
  }, [appointments, entries]);

  async function approve(id: string) {
    setError(null);
    try {
      const res = await approveVisitorAppointment(id);
      setCodeModal({
        code: res.verificationCode,
        delivery: res.delivery,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  }

  async function submitReject() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) return;
    setError(null);
    try {
      await rejectVisitorAppointment(rejectTarget.id, { reason });
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    }
  }

  return (
    <>
      <PageHeader
        title="Visitor support"
        description="Visitor appointments, host approve/reject, gate outcomes, and ID scans"
        actions={
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Appointments"
          value={stats.total}
          hint="All visitor bookings"
          icon={<CalendarClock className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          hint="Awaiting a decision"
          icon={<Clock className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          hint="Gate codes issued"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Entries today"
          value={stats.entriesToday}
          hint={`${stats.entriesTotal.toLocaleString('en-TZ')} recorded in total`}
          icon={<DoorOpen className="h-5 w-5" />}
          accent="sky"
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Visitor appointments</SectionTitle>
        <p className="mb-3 text-xs text-[#605e5c]">
          ID scan attachments (MinIO) — upload needs documents.manage +
          visitors.manage. Hosts can view scans on the customer portal (read-only).
        </p>
        <DataTable
          loading={loading}
          keyField="id"
          rows={appointments}
          emptyMessage="No appointments yet"
          columns={[
            { key: 'referenceNumber', label: 'Ref' },
            { key: 'visitorName', label: 'Visitor' },
            {
              key: 'hostName',
              label: 'Host',
              render: (r) => r.hostName ?? '—',
            },
            {
              key: 'idNumber',
              label: 'ID',
              render: (r) =>
                r.idType && r.idNumber ? (
                  <span className="inline-flex items-center rounded bg-[#f3f2f1] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#323130]">
                    {String(r.idType).replace(/_/g, ' ')} · {r.idNumber}
                  </span>
                ) : (
                  <span className="text-xs text-[#a19f9d]">—</span>
                ),
            },
            { key: 'purpose', label: 'Purpose' },
            {
              key: 'validUntil',
              label: 'Valid until',
              render: (r) => new Date(r.validUntil).toLocaleString(),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: 'id',
              label: 'Actions',
              render: (r) => (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0078d4] hover:underline"
                    onClick={() => setDocsTarget(r)}
                  >
                    <Paperclip className="h-3 w-3" />
                    Docs
                  </button>
                  {r.status === 'PENDING' ? (
                    <>
                      <button
                        type="button"
                        className="text-xs font-medium text-[#0067b8] hover:underline"
                        onClick={() => void approve(r.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-rose-600 hover:underline"
                        onClick={() => {
                          setRejectReason('');
                          setRejectTarget(r);
                        }}
                      >
                        Reject
                      </button>
                    </>
                  ) : r.status === 'APPROVED' ? (
                    <span className="text-xs text-[#605e5c]">Code issued</span>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Gate entries</SectionTitle>
        <p className="mb-3 text-xs text-[#605e5c]">
          Denied codes raise a Branch Ops FieldAlert (
          <code className="rounded bg-[#f3f2f1] px-1">VISITOR_GATE_DENIED</code>
          ) for Supervisor → Field → BOM → Control — escalate on{' '}
          <a href="/branch/alerts" className="font-semibold text-[#0078d4] hover:underline">
            /branch/alerts
          </a>
          . When the deny matches a known appointment, the host is notified by
          SMS/email if their User contact is on file.
        </p>
        <DataTable
          loading={loading}
          keyField="id"
          rows={entries}
          emptyMessage="No gate entries yet"
          columns={[
            { key: 'visitorName', label: 'Visitor' },
            {
              key: 'direction',
              label: 'Dir',
              render: (r) => {
                const dir = (r.direction ?? 'IN').toUpperCase();
                const out = dir === 'OUT';
                return (
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      out
                        ? 'bg-[#deecf9] text-[#004578]'
                        : 'bg-[#dff6dd] text-[#0b6a0b]'
                    }`}
                  >
                    {dir}
                  </span>
                );
              },
            },
            {
              key: 'result',
              label: 'Result',
              render: (r) => <StatusBadge status={r.result} />,
            },
            {
              key: 'denyReason',
              label: 'Reason',
              render: (r) =>
                r.denyReason ? (
                  <span className="text-xs text-[#605e5c]">{r.denyReason}</span>
                ) : (
                  '—'
                ),
            },
            {
              key: 'recordedAt',
              label: 'When',
              render: (r) => new Date(r.recordedAt).toLocaleString(),
            },
          ]}
        />
      </div>

      {rejectTarget ? (
        <Modal
          title="Reject appointment"
          description={`Provide a reason for rejecting ${rejectTarget.visitorName}'s visit (${rejectTarget.referenceNumber}).`}
          size="sm"
          onClose={() => {
            setRejectTarget(null);
            setRejectReason('');
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitReject();
            }}
          >
            <label className="block text-sm font-medium text-[#323130]">
              Rejection reason
              <input
                autoFocus
                className={inputCls}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Host unavailable"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={!rejectReason.trim()}
              >
                Reject appointment
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {codeModal ? (
        <Modal
          title="Gate code"
          description="Shown once — share this code with the visitor."
          size="sm"
          onClose={() => setCodeModal(null)}
        >
          <div className="flex flex-col items-center py-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dff6dd] text-[#107c10]">
              <KeyRound className="h-6 w-6" />
            </span>
            <p className="mt-4 font-mono text-3xl font-semibold tracking-widest text-[#1b1a19]">
              {codeModal.code}
            </p>
            {codeModal.delivery &&
            (codeModal.delivery.email ||
              codeModal.delivery.sms ||
              codeModal.delivery.whatsapp) ? (
              <ul className="mt-3 space-y-1 text-left text-sm text-[#107c10]">
                {codeModal.delivery.email ? (
                  <li>Code emailed to visitor</li>
                ) : null}
                {codeModal.delivery.sms ? (
                  <li>SMS queued to visitor phone</li>
                ) : null}
                {codeModal.delivery.whatsapp ? (
                  <li>WhatsApp queued to visitor phone</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#605e5c]">
                No email or phone on file — share manually.
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setCodeModal(null)}
            >
              Done
            </button>
          </div>
        </Modal>
      ) : null}

      {docsTarget ? (
        <VisitorIdScanModal
          appointment={docsTarget}
          canUpload={canUploadIdScan}
          onClose={() => setDocsTarget(null)}
        />
      ) : null}
    </>
  );
}

function VisitorIdScanModal({
  appointment,
  canUpload,
  onClose,
}: {
  appointment: VisitorAppointment;
  canUpload: boolean;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<DocumentObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listDocuments({
        resourceType: 'VisitorAppointment',
        resourceId: appointment.id,
      });
      setDocs(rows);
    } catch (err) {
      setError(formatDocError(err));
    } finally {
      setLoading(false);
    }
  }, [appointment.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Choose a file (pdf, png, jpeg, or webp — max 10MB)');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadDocument({
        file,
        resourceType: 'VisitorAppointment',
        resourceId: appointment.id,
      });
      setFile(null);
      await refresh();
    } catch (err) {
      setError(formatDocError(err));
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(doc: DocumentObject) {
    setError(null);
    try {
      const { url } = await getDocumentDownloadUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(formatDocError(err));
    }
  }

  return (
    <Modal
      title="Visitor ID scan"
      description={`${appointment.visitorName} · ${appointment.referenceNumber}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <p className="text-xs text-[#605e5c]">
          MinIO attachments on this appointment (resourceType=VisitorAppointment).
          Allowed: pdf / png / jpeg / webp · max 10MB.
          {canUpload
            ? ' Upload requires documents.manage + visitors.manage.'
            : ' View/download only — missing documents.manage or visitors.manage for upload.'}
        </p>
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}

        {canUpload ? (
          <form
            onSubmit={(e) => void onUpload(e)}
            className="flex flex-wrap items-end gap-2 rounded border border-[#edebe9] bg-[#faf9f8] px-3 py-2"
          >
            <label className="block min-w-[200px] flex-1 text-xs text-[#605e5c]">
              File
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                className={`${inputCls} mt-1`}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="submit"
              className={btnPrimary}
              disabled={uploading || !file}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        ) : null}

        {loading ? (
          <p className="text-xs text-[#605e5c]">Loading attachments…</p>
        ) : docs.length === 0 ? (
          <p className="text-xs text-[#605e5c]">No ID scans yet.</p>
        ) : (
          <ul className="divide-y divide-[#edebe9] rounded border border-[#edebe9]">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-[#323130]">{d.fileName}</p>
                  <p className="text-[11px] text-[#605e5c]">
                    {d.contentType} · {formatBytes(d.sizeBytes)} ·{' '}
                    {new Date(d.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-[#0078d4] hover:underline"
                  onClick={() => void onDownload(d)}
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
