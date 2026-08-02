'use client';

import {
  getCustomerAttachedDocumentUrl,
  getCustomerMe,
  listCustomerAttachedDocuments,
  listCustomerContractDocuments,
  listCustomerContracts,
  listCustomerInvoices,
  type Contract,
  type Invoice,
} from '@pssms/api-client';
import {
  Download,
  FileText,
  FolderOpen,
  Mail,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalPanel,
  PortalStat,
  PortalToolbar,
  StatusPill,
  formatDate,
  money,
} from '../../_components/portal-ui';

type DocRow = {
  id: string;
  kind: 'CONTRACT' | 'INVOICE';
  ref: string;
  title: string;
  status: string;
  date: string;
  meta?: string;
};

type AttachedDoc = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  source?: string;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [attachments, setAttachments] = useState<AttachedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await getCustomerMe();
      const [contracts, invoices, customerFiles] = await Promise.all([
        listCustomerContracts(),
        listCustomerInvoices(),
        listCustomerAttachedDocuments(me.id).catch(() => [] as AttachedDoc[]),
      ]);
      const contractFileLists = await Promise.all(
        (contracts as Contract[]).map(async (c) => {
          const files = await listCustomerContractDocuments(c.id).catch(
            () => [] as AttachedDoc[],
          );
          return files.map((f) => ({
            ...f,
            source: c.contractNumber,
          }));
        }),
      );
      const byId = new Map<string, AttachedDoc>();
      for (const f of customerFiles) {
        byId.set(f.id, { ...f, source: 'Customer profile' });
      }
      for (const f of contractFileLists.flat()) {
        byId.set(f.id, f);
      }
      setAttachments(
        [...byId.values()].sort((a, b) =>
          (b.createdAt || '').localeCompare(a.createdAt || ''),
        ),
      );
      const contractDocs: DocRow[] = (contracts as Contract[]).map((c) => ({
        id: `c-${c.id}`,
        kind: 'CONTRACT',
        ref: c.contractNumber,
        title: c.title,
        status: c.status,
        date: c.startDate,
        meta: `${c.serviceType} · ${money(c.monthlyFee, c.currency)}/mo`,
      }));
      const invoiceDocs: DocRow[] = (invoices as Invoice[]).map((i) => ({
        id: `i-${i.id}`,
        kind: 'INVOICE',
        ref: i.invoiceNumber ?? i.id.slice(0, 8),
        title: `Invoice ${i.invoiceNumber ?? ''}`.trim(),
        status: i.status,
        date: i.issueDate ?? i.dueDate ?? '',
        meta: money(i.totalAmount ?? 0, i.currency ?? 'TZS'),
      }));
      setDocs(
        [...contractDocs, ...invoiceDocs].sort((a, b) =>
          (b.date || '').localeCompare(a.date || ''),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const contracts = docs.filter((d) => d.kind === 'CONTRACT').length;
  const invoices = docs.filter((d) => d.kind === 'INVOICE').length;

  const filters = [
    { id: 'ALL', label: 'All index', count: docs.length },
    { id: 'CONTRACT', label: 'Contracts', count: contracts },
    { id: 'INVOICE', label: 'Invoices', count: invoices },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (kindFilter !== 'ALL' && d.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.ref.toLowerCase().includes(q) ||
        (d.meta ?? '').toLowerCase().includes(q)
      );
    });
  }, [docs, search, kindFilter]);

  async function onDownload(doc: AttachedDoc) {
    setDownloadingId(doc.id);
    setError(null);
    try {
      const { url } = await getCustomerAttachedDocumentUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Support"
        title="Documents"
        subtitle="Shared files from HIGHLINK plus an index of your contracts and invoices."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <PortalStat
          label="Shared files"
          value={loading ? '—' : attachments.length}
          tone="teal"
        />
        <PortalStat label="Contracts" value={loading ? '—' : contracts} tone="sky" />
        <PortalStat label="Invoices" value={loading ? '—' : invoices} tone="amber" />
      </div>

      <div className="mb-6">
        <PortalPanel title="Shared with you">
        {loading && attachments.length === 0 ? (
          <p className="text-sm text-[#605e5c]">Loading…</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-[#605e5c]">
            No files uploaded yet. HIGHLINK attaches signed contracts on each
            agreement (Docs) and shared certificates on your customer profile.
          </p>
        ) : (
          <ul className="divide-y divide-[#edebe9]">
            {attachments.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eff6fc] text-[#0078d4]">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1b1a19]">
                      {f.fileName}
                    </p>
                    <p className="text-[11px] text-[#8a8886]">
                      {f.source ? `${f.source} · ` : ''}
                      {formatBytes(f.sizeBytes)} · {formatDate(f.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={downloadingId === f.id}
                  onClick={() => void onDownload(f)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e1dfdd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0078d4] hover:bg-[#eff6fc] disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadingId === f.id ? 'Opening…' : 'Download'}
                </button>
              </li>
            ))}
          </ul>
        )}
        </PortalPanel>
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search contract # or invoice…"
        filters={filters}
        activeFilter={kindFilter}
        onFilterChange={setKindFilter}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <p className="text-sm text-[#605e5c]">Loading library…</p>
          ) : filtered.length === 0 ? (
            <PortalEmpty
              title="No documents indexed"
              description="Contracts and invoices appear here when created for your organisation."
              icon={<FolderOpen className="h-5 w-5" />}
            />
          ) : (
            <ul className="divide-y divide-[#edebe9] overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
              {filtered.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-[#faf9f8]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4]">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        {d.kind}
                      </span>
                      <span className="font-mono text-xs text-[#605e5c]">
                        {d.ref}
                      </span>
                      <StatusPill status={d.status} />
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-[#1b1a19]">
                      {d.title}
                    </p>
                    <p className="text-xs text-[#605e5c]">
                      {formatDate(d.date)}
                      {d.meta ? ` · ${d.meta}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <PortalPanel title="Need something else?">
          <p className="text-sm text-[#605e5c]">
            Ask your HIGHLINK account team to attach signed PDFs to this
            portal. Quote a contract or invoice reference when you write.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center gap-2 rounded-xl bg-[#faf9f8] px-3 py-2 ring-1 ring-[#e1dfdd]">
              <Mail className="h-4 w-4 text-[#0078d4]" />
              <a
                className="font-medium text-[#0078d4] hover:underline"
                href="mailto:accounts@highlink.co.tz"
              >
                accounts@highlink.co.tz
              </a>
            </li>
            <li className="flex items-center gap-2 rounded-xl bg-[#faf9f8] px-3 py-2 ring-1 ring-[#e1dfdd]">
              <Phone className="h-4 w-4 text-teal-700" />
              <span className="font-medium text-[#323130]">+255 700 000 000</span>
            </li>
          </ul>
        </PortalPanel>
      </div>

      <PortalDeferral note="Portal users can download shared files only — uploads stay with HIGHLINK (customer profile or contract Docs). Automatic expiry reminders still deferred." />
    </div>
  );
}
