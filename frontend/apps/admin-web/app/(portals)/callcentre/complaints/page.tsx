'use client';

import {
  createStaffComplaint,
  listCallCentreCustomerOptions,
  listStaffComplaints,
  updateStaffComplaint,
  type StaffComplaint,
  type SupportCustomerOption,
} from '@pssms/api-client';
import {
  DataTable,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

const CMP_NEXT: Record<string, string[]> = {
  OPEN: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['UNDER_REVIEW', 'RESOLVED', 'CLOSED'],
  UNDER_REVIEW: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
};

export default function CallCentreComplaintsPage() {
  const [rows, setRows] = useState<StaffComplaint[]>([]);
  const [customers, setCustomers] = useState<SupportCustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closeRow, setCloseRow] = useState<StaffComplaint | null>(null);
  const [notes, setNotes] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, opts] = await Promise.all([
        listStaffComplaints(),
        listCallCentreCustomerOptions(),
      ]);
      setRows(list);
      setCustomers(opts);
      setCustomerId((prev) => prev || opts[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function advance(row: StaffComplaint, status: string) {
    if (status === 'CLOSED') {
      setCloseRow(row);
      setNotes(row.resolutionNotes ?? '');
      return;
    }
    try {
      await updateStaffComplaint(row.id, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#605e5c]">
        Customer complaint register (distinct from tickets). Creator cannot
        acknowledge or close their own complaint.
      </p>
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 rounded-md border border-[#e1dfdd] p-3 md:grid-cols-4">
        <select
          className={inputCls + ' mt-0'}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
        <input
          className={inputCls + ' mt-0'}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={inputCls + ' mt-0 md:col-span-2'}
          placeholder="Description (min 10 chars)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="button"
          className={btnPrimary}
          disabled={busy || !customerId || title.length < 3 || description.length < 10}
          onClick={() =>
            void (async () => {
              setBusy(true);
              try {
                await createStaffComplaint({
                  customerId,
                  category: 'OTHER',
                  title,
                  description,
                });
                setTitle('');
                setDescription('');
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Create failed');
              } finally {
                setBusy(false);
              }
            })()
          }
        >
          Log complaint
        </button>
      </div>
      <DataTable
        loading={loading}
        keyField="id"
        rows={rows}
        emptyMessage="No complaints"
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
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'id',
            label: 'Actions',
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                {(CMP_NEXT[r.status] ?? []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="text-xs font-medium text-[#0067b8] hover:underline"
                    onClick={() => void advance(r, s)}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            ),
          },
        ]}
      />
      {closeRow ? (
        <Modal
          title="Close complaint"
          onClose={() => setCloseRow(null)}
          size="sm"
        >
          <textarea
            className={inputCls}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="button"
            className={btnSecondary + ' mt-2'}
            disabled={notes.trim().length < 2}
            onClick={() =>
              void (async () => {
                await updateStaffComplaint(closeRow.id, {
                  status: 'CLOSED',
                  resolutionNotes: notes,
                });
                setCloseRow(null);
                await load();
              })()
            }
          >
            Close
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
