'use client';

import {
  approveVisitorAppointment,
  listStaffServiceRequests,
  listVisitorAppointments,
  listVisitorEntries,
  rejectVisitorAppointment,
  updateStaffServiceRequest,
  type StaffServiceRequest,
  type VisitorAppointment,
  type VisitorEntry,
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
  CalendarClock,
  CheckCircle2,
  Clock,
  DoorOpen,
  Headset,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const NEXT_STATUS: Record<string, string[]> = {
  OPEN: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
};

export default function CallCentrePage() {
  const [appointments, setAppointments] = useState<VisitorAppointment[]>([]);
  const [entries, setEntries] = useState<VisitorEntry[]>([]);
  const [tickets, setTickets] = useState<StaffServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeModal, setCodeModal] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<VisitorAppointment | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState('');
  const [closeTarget, setCloseTarget] = useState<StaffServiceRequest | null>(
    null,
  );
  const [closeNotes, setCloseNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, e, t] = await Promise.all([
        listVisitorAppointments(),
        listVisitorEntries(),
        listStaffServiceRequests().catch(() => [] as StaffServiceRequest[]),
      ]);
      setAppointments(a);
      setEntries(e);
      setTickets(t);
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
    const openTickets = tickets.filter((t) =>
      ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(t.status),
    ).length;
    return {
      total: appointments.length,
      pending,
      approved,
      entriesToday,
      entriesTotal: entries.length,
      openTickets,
    };
  }, [appointments, entries, tickets]);

  async function approve(id: string) {
    setError(null);
    try {
      const res = await approveVisitorAppointment(id);
      setCodeModal(res.verificationCode);
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

  async function advanceTicket(row: StaffServiceRequest, status: string) {
    if (status === 'CLOSED') {
      setCloseTarget(row);
      setCloseNotes(row.resolutionNotes ?? '');
      return;
    }
    setError(null);
    try {
      await updateStaffServiceRequest(row.id, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ticket update failed');
    }
  }

  async function submitClose() {
    if (!closeTarget) return;
    const notes = closeNotes.trim();
    if (!notes) return;
    setError(null);
    try {
      await updateStaffServiceRequest(closeTarget.id, {
        status: 'CLOSED',
        resolutionNotes: notes,
      });
      setCloseTarget(null);
      setCloseNotes('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Close failed');
    }
  }

  return (
    <>
      <PageHeader
        title="Call centre"
        description="Visitor appointments, gate outcomes, and customer service tickets"
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <StatCard
          label="Open tickets"
          value={stats.openTickets}
          hint="Customer service requests"
          icon={<Headset className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Service requests</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={tickets}
          emptyMessage="No customer service requests yet"
          columns={[
            { key: 'referenceNumber', label: 'Ref' },
            {
              key: 'customerCode',
              label: 'Customer',
              render: (r) =>
                r.customerCode
                  ? `${r.customerCode}${r.customerName ? ` · ${r.customerName}` : ''}`
                  : '—',
            },
            { key: 'title', label: 'Title' },
            {
              key: 'category',
              label: 'Category',
              render: (r) => r.category.replace(/_/g, ' '),
            },
            {
              key: 'urgency',
              label: 'Urgency',
              render: (r) => r.urgency.replace(/_/g, ' '),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: 'id',
              label: 'Actions',
              render: (r) => {
                const next = NEXT_STATUS[r.status] ?? [];
                if (next.length === 0) {
                  return <span className="text-xs text-[#605e5c]">—</span>;
                }
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    {next.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="text-xs font-medium text-[#0067b8] hover:underline"
                        onClick={() => void advanceTicket(r, s)}
                      >
                        {s.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Visitor appointments</SectionTitle>
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
              render: (r) =>
                r.status === 'PENDING' ? (
                  <div className="flex items-center gap-3">
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
                  </div>
                ) : r.status === 'APPROVED' ? (
                  <span className="text-xs text-[#605e5c]">Code issued</span>
                ) : (
                  <span className="text-xs text-[#605e5c]">—</span>
                ),
            },
          ]}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Gate entries</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={entries}
          emptyMessage="No gate entries yet"
          columns={[
            { key: 'visitorName', label: 'Visitor' },
            {
              key: 'result',
              label: 'Result',
              render: (r) => <StatusBadge status={r.result} />,
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

      {closeTarget ? (
        <Modal
          title="Close service request"
          description={`Add resolution notes for ${closeTarget.referenceNumber}.`}
          size="sm"
          onClose={() => {
            setCloseTarget(null);
            setCloseNotes('');
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitClose();
            }}
          >
            <label className="block text-sm font-medium text-[#323130]">
              Resolution notes
              <textarea
                autoFocus
                rows={3}
                className={inputCls}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="What was done / outcome"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setCloseTarget(null);
                  setCloseNotes('');
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={!closeNotes.trim()}
              >
                Close ticket
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
              {codeModal}
            </p>
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
    </>
  );
}
