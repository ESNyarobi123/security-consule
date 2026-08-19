'use client';

import {
  exportDeveloperPack,
  type DeveloperExportKind,
} from '@pssms/api-client';
import { GlassCard, btnSecondary } from '@pssms/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';

const KINDS: { id: DeveloperExportKind; label: string; note: string }[] = [
  {
    id: 'logs',
    label: 'Request logs',
    note: 'Safe IntegrationRequestLog fields (no payloads).',
  },
  {
    id: 'webhooks',
    label: 'Webhook inbox',
    note: 'Status and errors only — no raw bodies.',
  },
  {
    id: 'outbox',
    label: 'Integration outbox',
    note: 'Pending/failed events — no secret payloads.',
  },
];

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DeveloperExportPage() {
  const [busy, setBusy] = useState<DeveloperExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const onExport = async (kind: DeveloperExportKind) => {
    setBusy(kind);
    setError(null);
    try {
      const pack = await exportDeveloperPack(kind);
      downloadCsv(pack.filename, pack.csv);
      setLast(`${pack.filename} · ${pack.rowCount} rows`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <DeveloperShell
      title="Data export"
      description="CSV of integration logs, webhooks, and outbox (cap 100, audited). Bulk master-data import is deferred — this portal does not ingest customer or HR spreadsheets."
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}
      {last ? (
        <p className="mb-3 text-xs text-[#107c10]">{last}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {KINDS.map((row) => (
          <GlassCard key={row.id} className="!p-3">
            <p className="text-sm font-semibold text-[#1b1a19]">{row.label}</p>
            <p className="mt-1 text-xs text-[#605e5c]">{row.note}</p>
            <button
              type="button"
              onClick={() => void onExport(row.id)}
              disabled={busy != null}
              className={`${btnSecondary} mt-3`}
            >
              <Download className="h-3.5 w-3.5" />
              {busy === row.id ? 'Exporting…' : 'Download CSV'}
            </button>
          </GlassCard>
        ))}
      </div>
    </DeveloperShell>
  );
}
