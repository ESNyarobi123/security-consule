'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

function IconImage({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21ZM12 9.75h.008v.008H12V9.75Z"
      />
    </svg>
  );
}

function IconPdf({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

function IconChevron({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function IconDownload({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 10.5 12 15m0 0 4.5-4.5M12 15V3"
      />
    </svg>
  );
}

type Props = {
  /** Element to capture (landscape ticket preferred). */
  targetRef: RefObject<HTMLElement | null>;
  fileBaseName: string;
};

export function DownloadMenu({ targetRef, fileBaseName }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'image' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function capturePng(): Promise<string> {
    const node = targetRef.current;
    if (!node) throw new Error('Ticket not ready yet.');
    return toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
  }

  async function downloadImage() {
    setBusy('image');
    setError(null);
    try {
      const dataUrl = await capturePng();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fileBaseName}.png`;
      a.click();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export image.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy('pdf');
    setError(null);
    try {
      const dataUrl = await capturePng();
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not load ticket image.'));
        img.src = dataUrl;
      });

      const orientation = img.width >= img.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation,
        unit: 'pt',
        format: 'a4',
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      pdf.addImage(dataUrl, 'PNG', x, y, w, h);
      pdf.save(`${fileBaseName}.pdf`);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export PDF.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1d4ed8] disabled:opacity-55"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!!busy}
        onClick={() => setOpen((v) => !v)}
      >
        <IconDownload />
        {busy ? 'Preparing…' : 'Download'}
        <IconChevron className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => void downloadImage()}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <IconImage />
            </span>
            <span>
              <span className="block font-semibold">Image</span>
              <span className="block text-xs font-normal text-slate-500">PNG file</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => void downloadPdf()}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <IconPdf />
            </span>
            <span>
              <span className="block font-semibold">PDF</span>
              <span className="block text-xs font-normal text-slate-500">Printable document</span>
            </span>
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="absolute left-0 top-full mt-2 w-64 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
