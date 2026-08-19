'use client';

import {
  createCallCentreTicket,
  escalateCallCentreTicket,
  getCallCentreTicketOptions,
  listCallCentreCustomerOptions,
  listStaffServiceRequests,
  updateStaffServiceRequest,
  type StaffServiceRequest,
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
import { useCallback, useEffect, useMemo, useState } from 'react';

const NEXT: Record<string, string[]> = {
  OPEN: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
};

export default function CallCentreTicketsPage() {
  const [rows, setRows] = useState<StaffServiceRequest[]>([]);
  const [customers, setCustomers] = useState<SupportCustomerOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closeRow, setCloseRow] = useState<StaffServiceRequest | null>(null);
  const [notes, setNotes] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [category, setCategory] = useState('PARKING');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, opts, cats] = await Promise.all([
        listStaffServiceRequests(),
        listCallCentreCustomerOptions(),
        getCallCentreTicketOptions(),
      ]);
      setRows(list);
      setCustomers(opts);
      setCategories(cats.categories);
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

  const shown = useMemo(
    () => (filter ? rows.filter((r) => r.category === filter) : rows),
    [rows, filter],
  );

  async function advance(row: StaffServiceRequest, status: string) {
    if (status === 'CLOSED') {
      setCloseRow(row);
      setNotes(row.resolutionNotes ?? '');
      return;
    }
    try {
      await updateStaffServiceRequest(row.id, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#605e5c]">
        Log inbound parking, supplier, payroll, visitor, and incident inquiries
        as tickets. Owning ledgers stay on those portals. Escalate to an OPEN
        incident for Branch Ops (CALL_CENTRE does not receive incidents.manage).
      </p>
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <select
          className={inputCls + ' mt-0 w-auto'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <div className="grid gap-2 rounded-md border border-[#e1dfdd] p-3 md:grid-cols-2 lg:grid-cols-4">
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
        <select
          className={inputCls + ' mt-0'}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
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
          className={inputCls + ' mt-0'}
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
                await createCallCentreTicket({
                  customerId,
                  category,
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
          Log ticket
        </button>
      </div>
      <DataTable
        loading={loading}
        keyField="id"
        rows={shown}
        emptyMessage="No tickets"
        columns={[
          { key: 'referenceNumber', label: 'Ref' },
          {
            key: 'customerCode',
            label: 'Customer',
            render: (r) => r.customerCode ?? '—',
          },
          { key: 'title', label: 'Title' },
          {
            key: 'category',
            label: 'Category',
            render: (r) => r.category.replace(/_/g, ' '),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'incidentNumber',
            label: 'Incident',
            render: (r) => r.incidentNumber ?? '—',
          },
          {
            key: 'id',
            label: 'Actions',
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                {(NEXT[r.status] ?? []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="text-xs font-medium text-[#0067b8] hover:underline"
                    onClick={() => void advance(r, s)}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
                {!r.incidentId &&
                r.status !== 'CLOSED' &&
                r.status !== 'CANCELLED' ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-700 hover:underline"
                    onClick={() =>
                      void escalateCallCentreTicket(r.id)
                        .then(() => load())
                        .catch((e: unknown) =>
                          setError(e instanceof Error ? e.message : 'Escalate failed'),
                        )
                    }
                  >
                    Escalate incident
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
      />
      {closeRow ? (
        <Modal title="Close ticket" onClose={() => setCloseRow(null)} size="sm">
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
                await updateStaffServiceRequest(closeRow.id, {
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
