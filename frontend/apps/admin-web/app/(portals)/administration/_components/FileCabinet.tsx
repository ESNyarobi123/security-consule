'use client';

import {
  getDocumentDownloadUrl,
  listDocuments,
  uploadDocument,
  type DocumentObject,
} from '@pssms/api-client';
import { btnPrimary, btnSecondary } from '@pssms/ui';
import { Download, FileText, Upload } from 'lucide-react';
import { useMemo, useState, type FormEvent, useEffect } from 'react';
import { fieldCls, formatApiError } from './shared';

export type FileRecord = {
  id: string;
  title: string;
  subtitle?: string;
};

export function FileCabinet({
  resourceType,
  records,
  recordsLoading,
  canUpload,
  emptyHint,
  autoSelectFirst = false,
}: {
  resourceType: string;
  records: FileRecord[];
  recordsLoading: boolean;
  canUpload: boolean;
  emptyHint: string;
  autoSelectFirst?: boolean;
}) {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocumentObject[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return records;
    return records.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        (r.subtitle ?? '').toLowerCase().includes(needle),
    );
  }, [q, records]);

  const selected = records.find((r) => r.id === selectedId) ?? null;
  const onlyId =
    autoSelectFirst && !recordsLoading && records.length === 1
      ? records[0]?.id ?? null
      : null;

  async function loadDocs(id: string) {
    setDocsLoading(true);
    setDocsError(null);
    try {
      setDocs(await listDocuments({ resourceType, resourceId: id }));
    } catch (err) {
      setDocs([]);
      setDocsError(formatApiError(err));
    } finally {
      setDocsLoading(false);
    }
  }

  async function onSelect(id: string) {
    setSelectedId(id);
    setFile(null);
    await loadDocs(id);
  }

  useEffect(() => {
    if (!onlyId || selectedId === onlyId) return;
    void onSelect(onlyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyId]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !file) {
      setDocsError('Choose a PDF or image (max 10MB).');
      return;
    }
    setUploading(true);
    setDocsError(null);
    try {
      await uploadDocument({ file, resourceType, resourceId: selectedId });
      setFile(null);
      await loadDocs(selectedId);
    } catch (err) {
      setDocsError(formatApiError(err));
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(doc: DocumentObject) {
    setDocsError(null);
    try {
      const { url } = await getDocumentDownloadUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDocsError(formatApiError(err));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-xl border border-[#e1dfdd] bg-white p-4 shadow-sm">
        <input
          className={`${fieldCls} w-full`}
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="mt-3 max-h-[480px] divide-y divide-[#edebe9] overflow-y-auto text-sm">
          {recordsLoading ? (
            <li className="py-6 text-center text-[#605e5c]">Loading…</li>
          ) : filtered.length === 0 ? (
            <li className="py-6 text-center text-[#605e5c]">{emptyHint}</li>
          ) : (
            filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => void onSelect(r.id)}
                  className={`flex w-full flex-col items-start px-2 py-2.5 text-left transition ${
                    selectedId === r.id
                      ? 'bg-sky-50 text-[#0078d4]'
                      : 'hover:bg-[#faf9f8]'
                  }`}
                >
                  <span className="font-medium">{r.title}</span>
                  {r.subtitle ? (
                    <span className="text-xs text-[#605e5c]">{r.subtitle}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-xl border border-[#e1dfdd] bg-white p-4 shadow-sm">
        {!selected ? (
          <p className="py-10 text-center text-sm text-[#605e5c]">
            Select a record to view files.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 text-[#0078d4]" />
              <div>
                <p className="text-sm font-semibold">{selected.title}</p>
                {selected.subtitle ? (
                  <p className="text-xs text-[#605e5c]">{selected.subtitle}</p>
                ) : null}
              </div>
            </div>

            {docsError ? (
              <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {docsError}
              </p>
            ) : null}

            {canUpload ? (
              <form
                onSubmit={(e) => void onUpload(e)}
                className="mt-4 flex flex-wrap items-end gap-2"
              >
                <label className="text-xs font-medium text-[#605e5c]">
                  Upload (pdf / png / jpeg / webp · 10MB)
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                    className="mt-1 block text-sm"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={uploading || !file}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-[#605e5c]">
                Upload needs documents.manage plus the parent domain permission.
              </p>
            )}

            <ul className="mt-4 divide-y divide-[#edebe9] text-sm">
              {docsLoading ? (
                <li className="py-4 text-[#605e5c]">Loading files…</li>
              ) : docs.length === 0 ? (
                <li className="py-4 text-[#605e5c]">No files on this record.</li>
              ) : (
                docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span className="min-w-0 truncate">
                      {d.fileName}
                      <span className="ml-2 text-xs text-[#8a8886]">
                        {(d.sizeBytes / 1024).toFixed(0)} KB
                      </span>
                    </span>
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => void onDownload(d)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Open
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
