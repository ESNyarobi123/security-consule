'use client';

import {
  createMarketingCampaign,
  listMarketingCampaigns,
  updateMarketingCampaign,
  type MarketingCampaign,
} from '@pssms/api-client';
import {
  DataTable,
  Modal,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

function errText(e: unknown) {
  if (!(e instanceof Error)) return 'Request failed';
  try {
    const j = JSON.parse(e.message) as { message?: string; error?: string };
    return j.message ?? j.error ?? e.message;
  } catch {
    return e.message;
  }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'EVENT', 'BRANCH', 'OTHER'];

const emptyCreate = {
  code: '',
  name: '',
  channel: 'EVENT',
  startsAt: '',
  endsAt: '',
  notes: '',
};

export default function MarketingCampaignsPage() {
  const [rows, setRows] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [create, setCreate] = useState({ ...emptyCreate });
  const [editRow, setEditRow] = useState<MarketingCampaign | null>(null);
  const [edit, setEdit] = useState({
    name: '',
    channel: 'EVENT',
    startsAt: '',
    endsAt: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listMarketingCampaigns());
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const active = rows.filter((r) => r.isActive).length;
  const totalLeads = rows.reduce((s, r) => s + r.totalLeads, 0);
  const wonLeads = rows.reduce((s, r) => s + r.wonLeads, 0);
  const pipelineValue = rows.reduce((s, r) => s + r.pipelineValue, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a19]">
            Campaigns &amp; attribution
          </h2>
          <p className="max-w-3xl text-xs text-[#605e5c]">
            Campaigns are named lead sources with live attribution — leads,
            won deals, pipeline value, and conversion rate. Not a bulk
            email/WhatsApp engine.
          </p>
        </div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => setCreateOpen(true)}
        >
          New campaign
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Campaigns" value={rows.length} hint={`${active} active`} accent="blue" />
        <StatCard label="Attributed leads" value={totalLeads} hint="All campaigns" accent="amber" />
        <StatCard label="Won from campaigns" value={wonLeads} hint="Closed-won leads" accent="emerald" />
        <StatCard label="Open pipeline" value={fmt(pipelineValue)} hint="Estimated value" accent="violet" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <DataTable
        loading={loading}
        rows={rows}
        keyField="id"
        emptyMessage="No campaigns yet."
        columns={[
          { key: 'code', label: 'Code' },
          {
            key: 'name',
            label: 'Campaign',
            render: (r) => (
              <div>
                <p className="font-medium text-[#1b1a19]">{r.name}</p>
                <p className="text-xs text-[#605e5c]">
                  {r.startsAt
                    ? new Date(r.startsAt).toLocaleDateString('en-GB')
                    : '—'}
                  {' → '}
                  {r.endsAt
                    ? new Date(r.endsAt).toLocaleDateString('en-GB')
                    : 'open'}
                </p>
              </div>
            ),
          },
          { key: 'channel', label: 'Channel' },
          {
            key: 'isActive',
            label: 'Status',
            render: (r) => (
              <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />
            ),
          },
          {
            key: 'totalLeads',
            label: 'Leads / won',
            render: (r) => (
              <div>
                <p>
                  {r.totalLeads} / {r.wonLeads}
                </p>
                <p className="text-xs text-[#605e5c]">
                  {r.conversionRate}% conversion
                </p>
              </div>
            ),
          },
          {
            key: 'pipelineValue',
            label: 'Pipeline / won',
            render: (r) => (
              <div>
                <p>{fmt(r.pipelineValue)}</p>
                <p className="text-xs text-[#605e5c]">won {fmt(r.wonValue)}</p>
              </div>
            ),
          },
          {
            key: 'id',
            label: '',
            render: (r) => (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy}
                  onClick={() => {
                    setEditRow(r);
                    setEdit({
                      name: r.name,
                      channel: r.channel,
                      startsAt: r.startsAt
                        ? new Date(r.startsAt).toISOString().slice(0, 10)
                        : '',
                      endsAt: r.endsAt
                        ? new Date(r.endsAt).toISOString().slice(0, 10)
                        : '',
                      notes: r.notes ?? '',
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      updateMarketingCampaign(r.id, { isActive: !r.isActive }),
                    )
                  }
                >
                  {r.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            ),
          },
        ]}
      />

      {createOpen ? (
        <Modal title="New campaign" onClose={() => setCreateOpen(false)}>
          <div className="space-y-3">
            <label className="block text-sm">
              Code (optional)
              <input
                className={inputCls}
                value={create.code}
                onChange={(e) =>
                  setCreate((s) => ({ ...s, code: e.target.value }))
                }
                placeholder="Auto-generated when blank"
              />
            </label>
            <label className="block text-sm">
              Name
              <input
                className={inputCls}
                value={create.name}
                onChange={(e) =>
                  setCreate((s) => ({ ...s, name: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              Channel
              <select
                className={inputCls}
                value={create.channel}
                onChange={(e) =>
                  setCreate((s) => ({ ...s, channel: e.target.value }))
                }
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                Starts
                <input
                  className={inputCls}
                  type="date"
                  value={create.startsAt}
                  onChange={(e) =>
                    setCreate((s) => ({ ...s, startsAt: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                Ends
                <input
                  className={inputCls}
                  type="date"
                  value={create.endsAt}
                  onChange={(e) =>
                    setCreate((s) => ({ ...s, endsAt: e.target.value }))
                  }
                />
              </label>
            </div>
            <label className="block text-sm">
              Notes
              <textarea
                className={inputCls}
                rows={2}
                value={create.notes}
                onChange={(e) =>
                  setCreate((s) => ({ ...s, notes: e.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || create.name.trim().length < 2}
              onClick={() =>
                void run(async () => {
                  await createMarketingCampaign({
                    name: create.name,
                    channel: create.channel,
                    code: create.code || undefined,
                    startsAt: create.startsAt
                      ? new Date(create.startsAt).toISOString()
                      : undefined,
                    endsAt: create.endsAt
                      ? new Date(create.endsAt).toISOString()
                      : undefined,
                    notes: create.notes || undefined,
                  });
                  setCreateOpen(false);
                  setCreate({ ...emptyCreate });
                })
              }
            >
              Create campaign
            </button>
          </div>
        </Modal>
      ) : null}

      {editRow ? (
        <Modal
          title={`Edit ${editRow.code}`}
          onClose={() => setEditRow(null)}
        >
          <div className="space-y-3">
            <label className="block text-sm">
              Name
              <input
                className={inputCls}
                value={edit.name}
                onChange={(e) =>
                  setEdit((s) => ({ ...s, name: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              Channel
              <select
                className={inputCls}
                value={edit.channel}
                onChange={(e) =>
                  setEdit((s) => ({ ...s, channel: e.target.value }))
                }
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                Starts
                <input
                  className={inputCls}
                  type="date"
                  value={edit.startsAt}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, startsAt: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                Ends
                <input
                  className={inputCls}
                  type="date"
                  value={edit.endsAt}
                  onChange={(e) =>
                    setEdit((s) => ({ ...s, endsAt: e.target.value }))
                  }
                />
              </label>
            </div>
            <label className="block text-sm">
              Notes
              <textarea
                className={inputCls}
                rows={2}
                value={edit.notes}
                onChange={(e) =>
                  setEdit((s) => ({ ...s, notes: e.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || edit.name.trim().length < 2}
              onClick={() =>
                void run(async () => {
                  await updateMarketingCampaign(editRow.id, {
                    name: edit.name,
                    channel: edit.channel,
                    startsAt: edit.startsAt
                      ? new Date(edit.startsAt).toISOString()
                      : undefined,
                    endsAt: edit.endsAt
                      ? new Date(edit.endsAt).toISOString()
                      : undefined,
                    notes: edit.notes || null,
                  });
                  setEditRow(null);
                })
              }
            >
              Save changes
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
