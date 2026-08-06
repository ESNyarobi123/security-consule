'use client';

import { ServiceIcon } from '@pssms/ui';
import { Check, Copy, ExternalLink, Map } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  DEMO_PASSWORD,
  EXTERNAL_PORTALS,
  INTERNAL_MODULES,
  resolvePortalUrl,
  type PortalEntry,
} from './_data';

function isProductionHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'web.hisgc.co.tz' || h.endsWith('.hisgc.co.tz');
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title={label ?? 'Copy'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#e1dfdd] bg-white text-[#605e5c] transition hover:border-[#0078d4] hover:text-[#0078d4]"
    >
      {ok ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function EnvBadge({ production }: { production: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        production
          ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
          : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
      }`}
    >
      {production ? 'Production (hisgc.co.tz)' : 'Local (localhost ports)'}
    </span>
  );
}

function PortalCard({
  entry,
  production,
}: {
  entry: PortalEntry;
  production: boolean;
}) {
  const primaryUrl = resolvePortalUrl(entry, { production });
  const openable = entry.kind === 'web' || entry.kind === 'api' || entry.kind === 'files';

  return (
    <article className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
      <header className="border-b border-[#edebe9] bg-gradient-to-r from-[#f8fafc] to-white px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-[#323130]">{entry.name}</h2>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[#605e5c]">
              {entry.designRef}
            </p>
          </div>
          <span className="rounded bg-[#eff6fc] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0078d4]">
            {entry.kind}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[#605e5c]">{entry.summary}</p>
      </header>

      <div className="space-y-3 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
            How it works
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#323130]">{entry.howItWorks}</p>
        </div>

        <div className="rounded-lg border border-[#edebe9] bg-[#faf9f8] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
            {production ? 'URL' : 'URL · port'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {openable ? (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 break-all text-[13px] font-medium text-[#0078d4] hover:underline"
              >
                {primaryUrl}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <span className="text-[13px] font-medium text-[#323130]">{primaryUrl}</span>
            )}
            <CopyBtn text={primaryUrl} label="Copy URL" />
            {!production && entry.localPort != null ? (
              <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[#605e5c] ring-1 ring-[#e1dfdd]">
                :{entry.localPort}
              </span>
            ) : null}
            {production && entry.prodHost ? (
              <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[#605e5c] ring-1 ring-[#e1dfdd]">
                {entry.prodHost}
              </span>
            ) : null}
          </div>
          {entry.altPaths?.length ? (
            <ul className="mt-2 space-y-1 border-t border-[#edebe9] pt-2">
              {entry.altPaths.map((alt) => {
                const u = resolvePortalUrl(entry, { production, path: alt.path });
                return (
                  <li key={alt.path} className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-medium text-[#605e5c]">{alt.label}:</span>
                    <a
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#0078d4] hover:underline"
                    >
                      {u}
                    </a>
                    <CopyBtn text={u} />
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {entry.logins.length ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
              Demo logins · password{' '}
              <code className="rounded bg-[#fff4ce] px-1 text-[#323130]">{DEMO_PASSWORD}</code>
            </p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-[#edebe9]">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-[#f3f2f1] text-[10px] uppercase tracking-wide text-[#605e5c]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-semibold">Email</th>
                    <th className="px-2.5 py-1.5 font-semibold">Role</th>
                    <th className="px-2.5 py-1.5 font-semibold">Note</th>
                    <th className="px-2.5 py-1.5 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {entry.logins.map((l) => (
                    <tr key={l.email} className="border-t border-[#edebe9]">
                      <td className="px-2.5 py-1.5 font-medium text-[#323130]">{l.email}</td>
                      <td className="px-2.5 py-1.5 text-[#605e5c]">{l.role}</td>
                      <td className="px-2.5 py-1.5 text-[#605e5c]">{l.note ?? '—'}</td>
                      <td className="px-2.5 py-1.5">
                        <CopyBtn text={l.email} label="Copy email" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-[#605e5c]">No end-user login (service endpoint).</p>
        )}
      </div>
    </article>
  );
}

export default function PortalDirectoryPage() {
  const [production, setProduction] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setProduction(isProductionHost());
  }, []);

  const portals = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return EXTERNAL_PORTALS;
    return EXTERNAL_PORTALS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.logins.some(
          (l) =>
            l.email.toLowerCase().includes(q) || l.role.toLowerCase().includes(q),
        ),
    );
  }, [filter]);

  const byKind = (kind: PortalEntry['kind']) => portals.filter((p) => p.kind === kind);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-gradient-to-br from-[#0b1f3a] via-[#0e2f52] to-[#123a63] px-5 py-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Map className="h-5 w-5 text-sky-300" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-200/90">
                Guide
              </p>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                Portal directory
              </h1>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-300">
                All HIGHLINK PSSMS portals, dashboards, URLs/ports (or production
                subdomains), demo logins, and a short note on how each one works.
                Seeded password for demos:{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-sky-100">
                  {DEMO_PASSWORD}
                </code>
              </p>
            </div>
          </div>
          <EnvBadge production={production} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by portal, email, or role…"
            className="w-full max-w-md rounded-md border border-white/15 bg-white/95 px-3 py-2 text-[13px] text-slate-800 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-sky-400/50"
          />
          <button
            type="button"
            onClick={() => setProduction((p) => !p)}
            className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-[12px] font-medium text-white hover:bg-white/15"
          >
            Show as {production ? 'local ports' : 'production URLs'}
          </button>
          <CopyBtn text={DEMO_PASSWORD} label="Copy demo password" />
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          Demo credentials are for training / UAT. Do not reuse in real customer
          production without rotating. Docker on busy machines may remap ports
          (e.g. admin 3020, API 4101, executive 3011) — check your compose{' '}
          <code className="text-slate-300">*_HOST_PORT</code>.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#605e5c]">
          <ServiceIcon glyph="grid" color="#0078d4" size="sm" />
          Web portals & apps
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {byKind('web').map((p) => (
            <PortalCard key={p.id} entry={p} production={production} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#605e5c]">
          <ServiceIcon glyph="code" color="#475569" size="sm" />
          API & files
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {[...byKind('api'), ...byKind('files')].map((p) => (
            <PortalCard key={p.id} entry={p} production={production} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#605e5c]">
          <ServiceIcon glyph="shield-user" color="#059669" size="sm" />
          Mobile apps
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {byKind('mobile').map((p) => (
            <PortalCard key={p.id} entry={p} production={production} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#605e5c]">
          <ServiceIcon glyph="building" color="#0ea5e9" size="sm" />
          Inside Admin console (same host as web.hisgc.co.tz / :3000)
        </h2>
        <p className="text-[13px] text-[#605e5c]">
          These are routes in the Admin app — login once at the Admin URL, then
          open the module your role allows.
        </p>
        <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-[#edebe9] bg-[#f3f2f1] text-[10px] uppercase tracking-wide text-[#605e5c]">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Module</th>
                <th className="px-3 py-2.5 font-semibold">Path</th>
                <th className="px-3 py-2.5 font-semibold">What it does</th>
                <th className="px-3 py-2.5 font-semibold">Typical demos</th>
              </tr>
            </thead>
            <tbody>
              {INTERNAL_MODULES.map((m) => (
                <tr key={m.href} className="border-t border-[#edebe9] align-top hover:bg-[#faf9f8]">
                  <td className="px-3 py-2.5 font-medium text-[#323130]">{m.label}</td>
                  <td className="px-3 py-2.5">
                    <a href={m.href} className="font-mono text-[12px] text-[#0078d4] hover:underline">
                      {m.href}
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-[#605e5c]">{m.description}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[#605e5c]">{m.typicalLogins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
