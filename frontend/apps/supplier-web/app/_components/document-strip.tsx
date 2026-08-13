'use client';

import {
  getDocumentDownloadUrl,
  listDocuments,
  uploadDocument,
  type DocumentObject,
} from '@pssms/api-client';
import { FileUp, Paperclip } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export function DocumentStrip({
  resourceType,
  resourceId,
  label = 'Attachments',
  hint,
}: {
  resourceType: string;
  resourceId: string;
  label?: string;
  hint?: string;
}) {
  const [docs, setDocs] = useState<DocumentObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDocs(await listDocuments({ resourceType, resourceId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load files');
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      await uploadDocument({ file, resourceType, resourceId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function openDoc(id: string) {
    try {
      const { url } = await getDocumentDownloadUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  return (
    <div className="rounded-xl border border-[#edebe9] bg-[#faf9f8] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#1b1a19]">{label}</p>
          {hint ? <p className="mt-0.5 text-xs text-[#605e5c]">{hint}</p> : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#c8c6c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#323130] hover:bg-white disabled:opacity-60"
        >
          <FileUp className="h-3.5 w-3.5" />
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onFile(file);
          }}
        />
      </div>
      {error ? (
        <p className="mt-2 text-xs text-rose-700">{error}</p>
      ) : null}
      {loading ? (
        <p className="mt-3 text-xs text-[#605e5c]">Loading files…</p>
      ) : docs.length === 0 ? (
        <p className="mt-3 text-xs text-[#605e5c]">No files yet (PDF / PNG / JPEG / WebP, max 10MB).</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {docs.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => void openDoc(d.id)}
                className="inline-flex max-w-full items-center gap-1.5 text-left text-xs font-medium text-[#0078d4] hover:underline"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{d.fileName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
