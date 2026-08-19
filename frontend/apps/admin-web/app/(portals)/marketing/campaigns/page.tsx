'use client';

import {
  createMarketingCampaign,
  listMarketingCampaigns,
  updateMarketingCampaign,
  type MarketingCampaign,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

export default function MarketingCampaignsPage() {
  const [rows, setRows] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('EVENT');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listMarketingCampaigns());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#605e5c]">
        Campaigns are lead sources only — not a bulk email or WhatsApp engine.
      </p>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Name
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-sm">
          Channel
          <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value)}>
            {['EMAIL', 'SMS', 'WHATSAPP', 'EVENT', 'BRANCH', 'OTHER'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={btnPrimary}
          disabled={busy || name.length < 2}
          onClick={() =>
            void (async () => {
              setBusy(true);
              try {
                await createMarketingCampaign({ name, channel });
                setName('');
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Create failed');
              } finally {
                setBusy(false);
              }
            })()
          }
        >
          Create campaign
        </button>
      </div>
      <DataTable
        loading={loading}
        rows={rows}
        keyField="id"
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'channel', label: 'Channel' },
          {
            key: 'isActive',
            label: 'Status',
            render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />,
          },
          {
            key: 'id',
            label: '',
            render: (r) => (
              <button
                type="button"
                className={btnSecondary}
                onClick={() =>
                  void updateMarketingCampaign(r.id, { isActive: !r.isActive }).then(() => load())
                }
              >
                {r.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
