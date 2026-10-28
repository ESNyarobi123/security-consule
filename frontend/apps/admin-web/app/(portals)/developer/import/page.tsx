'use client';

import {
  getDeveloperImportOptions,
  importDeveloperDevices,
  type DeveloperImportOptions,
  type DeveloperImportReport,
} from '@pssms/api-client';
import { DataTable, GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { CheckCircle2, FileUp, RefreshCw, Upload, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';
import { PanelEmpty } from '../_components/shared';

const ACTION_BADGE: Record<string, string> = {
  CREATE: 'ACTIVE',
  UPDATE: 'PENDING',
  SKIP: 'DRAFT',
  ERROR: 'SUSPENDED',
};

export default function DeveloperImportPage() {
  const [options, setOptions] = useState<DeveloperImportOptions | null>(null);
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<DeveloperImportReport | null>(null);
  const [result, setResult] = useState<DeveloperImportReport | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setOptions(await getDeveloperImportOptions());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rowCount = useMemo(
    () => csv.split(/\r?\n/).filter((l) => l.trim()).length,
    [csv],
  );

  const onPreview = async () => {
    setBusy('preview');
    setError(null);
    setResult(null);
    try {
      setPreview(await importDeveloperDevices(csv, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const onCommit = async () => {
    setBusy('commit');
    setError(null);
    try {
      const report = await importDeveloperDevices(csv, false);
      setResult(report);
      setPreview(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setPreview(null);
    setResult(null);
  };

  const report = result ?? preview;

  return (
    <DeveloperShell
      title="Data import"
      description="Bulk-onboard the device registry (biometric, face, CCTV, RFID, QR, printers) from CSV. Preview validates every row first; the commit is audited. Customer, HR and payroll spreadsheets stay with their owning portals."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          className={btnSecondary}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload contract
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <GlassCard className="!p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
              CSV paste {rowCount > 0 ? `· ${rowCount} line(s)` : ''}
            </h2>
            <label
              className={`${btnSecondary} cursor-pointer`}
              title="Pick a .csv file"
            >
              <FileUp className="h-3.5 w-3.5" />
              Choose file
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
              setResult(null);
            }}
            spellCheck={false}
            rows={12}
            placeholder={options?.sample ?? 'code,name,type,connection,siteCode,vendor,model,serialNumber'}
            className="w-full rounded-md border border-[#8a8886] bg-white px-3 py-2 font-mono text-[11px] text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onPreview()}
              disabled={busy !== null || !csv.trim()}
              className={btnSecondary}
            >
              {busy === 'preview' ? 'Validating…' : 'Preview / validate'}
            </button>
            <button
              type="button"
              onClick={() => void onCommit()}
              disabled={
                busy !== null ||
                !csv.trim() ||
                !preview ||
                preview.dryRun !== true ||
                preview.failed === preview.total ||
                preview.created + preview.updated === 0
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0078d4] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#106ebe] disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {busy === 'commit' ? 'Importing…' : 'Commit import'}
            </button>
            {report ? (
              <span className="text-[11px] text-[#605e5c]">
                {report.created} create · {report.updated} update ·{' '}
                {report.skipped} skip · {report.failed} error
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-[#8a8886]">
            Commit is only enabled after a clean preview, and only when the file
            would change something.
          </p>
        </GlassCard>

        <GlassCard className="!p-4">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
            Column contract
          </h2>
          {!options ? (
            <PanelEmpty
              icon={<FileUp className="h-4 w-4" />}
              title="Loading contract…"
              description="Fetching the accepted columns and enums from core-api."
            />
          ) : (
            <div className="space-y-3 text-[11px] text-[#605e5c]">
              <p>
                <span className="font-semibold text-[#323130]">Required:</span>{' '}
                {options.required.join(', ')}
              </p>
              <p>
                <span className="font-semibold text-[#323130]">Columns:</span>{' '}
                {options.columns.join(', ')}
              </p>
              <div>
                <p className="font-semibold text-[#323130]">Device types</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {options.deviceTypes.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-[#f3f2f1] px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-semibold text-[#323130]">Connections</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {options.connections.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-[#f3f2f1] px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <ul className="list-disc space-y-1 pl-4">
                {options.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </GlassCard>
      </div>

      {report ? (
        <section className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
              {result ? 'Import result' : 'Preview'} ({report.rows.length})
            </h2>
            <span
              className={`inline-flex items-center gap-1 text-[11px] ${
                report.failed > 0 ? 'text-rose-700' : 'text-[#107c10]'
              }`}
            >
              {report.failed > 0 ? (
                <XCircle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {result
                ? `Committed ${new Date(result.importedAt).toLocaleString()}`
                : 'Nothing written — this is a dry run'}
            </span>
          </div>
          <GlassCard className="!p-0 overflow-hidden">
            <DataTable<DeveloperImportReport['rows'][number]>
              keyField="line"
              rows={report.rows}
              emptyMessage="No rows"
              columns={[
                {
                  key: 'line',
                  label: 'Line',
                  render: (row) => (
                    <span className="font-mono text-xs">{row.line}</span>
                  ),
                },
                {
                  key: 'code',
                  label: 'Device code',
                  render: (row) => (
                    <span className="font-mono text-xs">{row.code}</span>
                  ),
                },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => (
                    <StatusBadge status={ACTION_BADGE[row.action] ?? 'DRAFT'} />
                  ),
                },
                {
                  key: 'message',
                  label: 'Detail',
                  render: (row) => (
                    <span className="text-xs text-[#605e5c]">
                      {row.message ?? row.action.toLowerCase()}
                    </span>
                  ),
                },
              ]}
            />
          </GlassCard>
        </section>
      ) : null}
    </DeveloperShell>
  );
}
