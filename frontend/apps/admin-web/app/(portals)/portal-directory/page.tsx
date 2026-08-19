'use client';

import { ServiceIcon } from '@pssms/ui';
import {
  Check,
  Copy,
  ExternalLink,
  Globe2,
  KeyRound,
  Map,
  Smartphone,
  Server,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

function CopyBtn({
  text,
  label,
  light,
}: {
  text: string;
  label?: string;
  light?: boolean;
}) {
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
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
        light
          ? 'border-white/20 bg-white/10 text-sky-100 hover:bg-white/20'
          : 'border-[#e1dfdd] bg-white text-[#605e5c] hover:border-[#0078d4] hover:text-[#0078d4]'
      }`}
    >
      {ok ? (
        <Check className={`h-3.5 w-3.5 ${light ? 'text-emerald-300' : 'text-emerald-600'}`} />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function kindMeta(kind: PortalEntry['kind']) {
  const map = {
    web: { label: 'Web', color: '#0078d4', bg: '#eff6fc' },
    api: { label: 'API', color: '#475569', bg: '#f1f5f9' },
    files: { label: 'Files', color: '#0d9488', bg: '#f0fdfa' },
    mobile: { label: 'Mobile', color: '#059669', bg: '#ecfdf5' },
    internal: { label: 'Internal', color: '#6366f1', bg: '#eef2ff' },
  } as const;
  return map[kind];
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
  const meta = kindMeta(entry.kind);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-[#c7e0f4] hover:shadow-[0_8px_24px_rgba(0,120,212,0.08)]">
      <header className="relative border-b border-[#edebe9] px-4 py-3.5">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg, ${meta.color}, transparent)` }}
        />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-[#323130]">
              {entry.name}
            </h2>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[#605e5c]">
              {entry.designRef}
            </p>
          </div>
          <span
            className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: meta.color, background: meta.bg }}
          >
            {meta.label}
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#605e5c]">{entry.summary}</p>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a19f9d]">
            How it works
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#323130]">{entry.howItWorks}</p>
        </div>

        <div className="rounded-lg border border-[#edebe9] bg-[#faf9f8] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a19f9d]">
            {production ? 'Production URL' : 'Local URL · port'}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {openable ? (
              <a
                href={primaryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1 break-all text-[12.5px] font-semibold text-[#0078d4] hover:underline"
              >
                <span className="truncate">{primaryUrl}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
              </a>
            ) : (
              <span className="text-[12.5px] font-semibold text-[#323130]">{primaryUrl}</span>
            )}
            <CopyBtn text={primaryUrl} label="Copy URL" />
            {!production && entry.localPort != null ? (
              <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#605e5c] ring-1 ring-[#e1dfdd]">
                :{entry.localPort}
              </span>
            ) : null}
          </div>
          {entry.altPaths?.length ? (
            <ul className="mt-2 space-y-1.5 border-t border-[#e1dfdd] pt-2">
              {entry.altPaths.map((alt) => {
                const u = resolvePortalUrl(entry, { production, path: alt.path });
                return (
                  <li key={alt.path} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                    <span className="rounded bg-[#eff6fc] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#0078d4]">
                      {alt.label}
                    </span>
                    <a
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-[#0078d4] hover:underline"
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
          <div className="mt-auto">
            <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#a19f9d]">
              <KeyRound className="h-3 w-3" />
              Demo logins ·{' '}
              <code className="rounded bg-[#fff4ce] px-1 normal-case text-[#323130]">
                {DEMO_PASSWORD}
              </code>
            </p>
            <div className="max-h-52 overflow-auto rounded-lg border border-[#edebe9]">
              <table className="min-w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-[#f3f2f1] text-[10px] uppercase tracking-wide text-[#605e5c]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-semibold">Email</th>
                    <th className="px-2.5 py-1.5 font-semibold">Role</th>
                    <th className="px-2.5 py-1.5 font-semibold">Note</th>
                    <th className="w-8 px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {entry.logins.map((l) => (
                    <tr key={l.email} className="border-t border-[#edebe9] hover:bg-[#f8fafc]">
                      <td className="px-2.5 py-1.5 font-medium text-[#323130]">{l.email}</td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap text-[#605e5c]">{l.role}</td>
                      <td className="px-2.5 py-1.5 text-[#605e5c]">{l.note ?? '—'}</td>
                      <td className="px-1 py-1.5">
                        <CopyBtn text={l.email} label="Copy email" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-auto text-[12px] text-[#a19f9d]">No end-user login (service endpoint).</p>
        )}
      </div>
    </article>
  );
}

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#edebe9] pb-2">
      <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#323130]">
        {icon}
        {title}
      </h2>
      <span className="rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold text-[#0078d4]">
        {count}
      </span>
    </div>
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
        p.prodHost?.toLowerCase().includes(q) ||
        p.logins.some(
          (l) =>
            l.email.toLowerCase().includes(q) || l.role.toLowerCase().includes(q),
        ),
    );
  }, [filter]);

  const web = portals.filter((p) => p.kind === 'web');
  const infra = portals.filter((p) => p.kind === 'api' || p.kind === 'files');
  const mobile = portals.filter((p) => p.kind === 'mobile');

  const quickHosts = EXTERNAL_PORTALS.filter((p) => p.prodHost);

  return (
    /* Cancel AdminShell main padding → full content width, no side gutters */
    <div className="-m-4 w-[calc(100%+2rem)] min-w-0 md:-m-7 md:w-[calc(100%+3.5rem)]">
      {/* Full-bleed hero */}
      <header className="relative overflow-hidden border-b border-[#0b1f3a] bg-[#0b1f3a] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 10% 0%, #0078d4 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 90% 20%, #0ea5e9 0%, transparent 50%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative px-4 py-6 md:px-7 md:py-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300/90">
                <Map className="h-3.5 w-3.5" />
                Guide · HIGHLINK PSSMS
              </div>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight md:text-3xl">
                Portal directory
              </h1>
              <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-slate-300">
                Full map of portals, HTTPS subdomains (or local ports), demo logins,
                and how each surface works. Internal modules share{' '}
                <span className="text-sky-200">web.hisgc.co.tz</span> — no extra
                subdomain per HR / Branch / CCTV route. IAM map of accounts ↔
                portals:{' '}
                <a
                  href="/superadmin/portals"
                  className="font-semibold text-sky-200 underline decoration-sky-500/50 underline-offset-2 hover:text-white"
                >
                  Super Admin · Portals
                </a>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                  production
                    ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/30'
                    : 'bg-amber-400/15 text-amber-100 ring-1 ring-amber-400/30'
                }`}
              >
                <Globe2 className="h-3.5 w-3.5" />
                {production ? 'Production URLs' : 'Local ports'}
              </span>
              <button
                type="button"
                onClick={() => setProduction((p) => !p)}
                className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/20"
              >
                Switch to {production ? 'local' : 'production'}
              </button>
              <div className="flex items-center gap-1.5 rounded-md border border-white/15 bg-black/20 px-2.5 py-1.5">
                <span className="text-[11px] text-slate-400">Password</span>
                <code className="text-[12px] font-semibold text-sky-100">{DEMO_PASSWORD}</code>
                <CopyBtn text={DEMO_PASSWORD} label="Copy password" light />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter portals, host, email, or role…"
              className="w-full flex-1 rounded-lg border border-white/15 bg-white/95 px-3.5 py-2.5 text-[13px] text-slate-800 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-sky-400/50"
            />
            <div className="flex flex-wrap gap-1.5">
              {quickHosts.map((p) => {
                const href = resolvePortalUrl(p, {
                  production: true,
                  path: p.path === '(Expo app)' ? '/' : p.path,
                });
                return (
                  <a
                    key={p.id}
                    href={production ? resolvePortalUrl(p, { production }) : href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-sky-100 transition hover:bg-white/15"
                    title={p.name}
                  >
                    {p.prodHost?.replace('.hisgc.co.tz', '')}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-8 bg-[#f5f6fa] px-4 py-6 md:px-7 md:py-8">
        <section className="space-y-3">
          <SectionTitle
            icon={<ServiceIcon glyph="grid" color="#0078d4" size="sm" />}
            title="Web portals & apps"
            count={web.length}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {web.map((p) => (
              <PortalCard key={p.id} entry={p} production={production} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle
            icon={<Server className="h-4 w-4 text-[#475569]" />}
            title="API & files"
            count={infra.length}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {infra.map((p) => (
              <PortalCard key={p.id} entry={p} production={production} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle
            icon={<Smartphone className="h-4 w-4 text-[#059669]" />}
            title="Mobile apps"
            count={mobile.length}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {mobile.map((p) => (
              <PortalCard key={p.id} entry={p} production={production} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle
            icon={<ServiceIcon glyph="building" color="#0ea5e9" size="sm" />}
            title="Inside Admin console (web.hisgc.co.tz routes)"
            count={INTERNAL_MODULES.length}
          />
          <p className="text-[13px] text-[#605e5c]">
            Login once on Admin, then open the module your role allows — same host,
            different paths.
          </p>
          <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="border-b border-[#edebe9] bg-[#f3f2f1] text-[10px] uppercase tracking-wide text-[#605e5c]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Module</th>
                    <th className="px-4 py-3 font-semibold">Path</th>
                    <th className="px-4 py-3 font-semibold">What it does</th>
                    <th className="px-4 py-3 font-semibold">Typical demos</th>
                  </tr>
                </thead>
                <tbody>
                  {INTERNAL_MODULES.map((m) => (
                    <tr
                      key={m.href}
                      className="border-t border-[#edebe9] align-top transition hover:bg-[#f3f9fd]"
                    >
                      <td className="px-4 py-3 font-semibold text-[#323130]">{m.label}</td>
                      <td className="px-4 py-3">
                        <a
                          href={m.href}
                          className="font-mono text-[12px] font-medium text-[#0078d4] hover:underline"
                        >
                          {m.href}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-[#605e5c]">{m.description}</td>
                      <td className="px-4 py-3 text-[12px] text-[#605e5c]">{m.typicalLogins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-[#a19f9d]">
            Demo credentials are for training / UAT. Docker on busy machines may remap
            ports (admin 3020, API 4101, executive 3011) — check compose{' '}
            <code className="text-[#605e5c]">*_HOST_PORT</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
