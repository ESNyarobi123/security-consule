'use client';

import type { NavItem } from '@pssms/permissions';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AzureGlyph, ServiceIcon, moduleVisual } from './azure';

/** Shared Azure button class helpers for page-level actions. */
export const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-md bg-[#0078d4] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#106ebe] disabled:opacity-60';
export const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-md border border-[#8a8886] bg-white px-4 py-2 text-sm font-medium text-[#323130] transition hover:bg-[#f3f2f1] disabled:opacity-60';
export const inputCls =
  'mt-1 w-full rounded-md border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]';

/** Light Azure modal dialog (backdrop click / Escape to close). */
export function Modal({
  title,
  description,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const width =
    size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full ${width} rounded-xl border border-[#e1dfdd] bg-white p-6 shadow-2xl`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1b1a19]">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[13px] text-[#605e5c]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#605e5c] transition hover:bg-[#f3f2f1]"
          >
            <AzureGlyph name="plus" className="h-5 w-5 rotate-45" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const ok = 'bg-[#dff6dd] text-[#0e700e]';
  const colors: Record<string, string> = {
    ACTIVE: ok,
    DRAFT: 'bg-slate-100 text-slate-600',
    PAID: ok,
    SENT: 'bg-[#eff6fc] text-[#005a9e]',
    PARTIALLY_PAID: 'bg-amber-50 text-amber-700',
    ON_LEAVE: 'bg-amber-50 text-amber-700',
    SUSPENDED: 'bg-rose-50 text-rose-700',
    PENDING: 'bg-amber-50 text-amber-700',
    PENDING_APPROVAL: 'bg-amber-50 text-amber-700',
    APPROVED: ok,
    REJECTED: 'bg-rose-50 text-rose-700',
    CALCULATED: 'bg-[#eff6fc] text-[#005a9e]',
    VOIDED: 'bg-slate-100 text-slate-600',
    RECEIVED: ok,
    ALLOWED: ok,
    DENIED: 'bg-rose-50 text-rose-700',
  };
  const cls = colors[status] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <h3 className="text-lg font-medium text-slate-800">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? (
        <a
          href={action.href}
          className="mt-4 inline-block rounded-md bg-[#0078d4] px-4 py-2 text-sm font-medium text-white hover:bg-[#106ebe]"
        >
          {action.label}
        </a>
      ) : null}
    </div>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  keyField,
  loading,
  emptyMessage = 'No records',
}: {
  columns: { key: keyof T & string; label: string; render?: (row: T) => ReactNode }[];
  rows: T[];
  keyField: keyof T & string;
  loading?: boolean;
  emptyMessage?: string;
}) {
  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={String(row[keyField])}
              className="border-b border-slate-100 hover:bg-slate-50/80"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-700">
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminShell({
  userName,
  userEmail,
  userRole,
  directory = 'HIGHLINK DIRECTORY',
  nav,
  pathname,
  onLogout,
  children,
}: {
  userName: string;
  userEmail?: string;
  userRole?: string;
  directory?: string;
  nav: NavItem[];
  pathname: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const groups = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    const g = item.group ?? 'Other';
    acc[g] = acc[g] ?? [];
    acc[g].push(item);
    return acc;
  }, {});

  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'HL';

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pssms_admin_sidebar');
    if (saved === 'collapsed') setCollapsed(true);
    setReady(true);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(
        'pssms_admin_sidebar',
        next ? 'collapsed' : 'expanded',
      );
      return next;
    });
  }

  function onHamburger() {
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) {
      toggleCollapsed();
    } else {
      setMobileOpen(true);
    }
  }

  const isActive = (href: string) =>
    pathname === href ||
    (pathname.startsWith(`${href}/`) &&
      !nav.some(
        (other) =>
          other.href !== href &&
          other.href.startsWith(`${href}/`) &&
          (pathname === other.href || pathname.startsWith(`${other.href}/`)),
      ));

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as NavItem[];
    return nav
      .filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          (n.group ?? '').toLowerCase().includes(q) ||
          n.href.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, nav]);

  const fixedLinks: { href: string; label: string; glyph: 'home' | 'grid' | 'plus' }[] = [
    { href: '/superadmin', label: 'Home', glyph: 'home' },
    { href: '/superadmin', label: 'All services', glyph: 'grid' },
  ];

  const sidebarInner = (
    <>
      <a
        href="/superadmin/customers"
        onClick={() => setMobileOpen(false)}
        title={collapsed ? 'Create' : undefined}
        className={`flex items-center rounded-md text-[13px] font-semibold text-[#0067b8] transition hover:bg-[#f3f2f1] ${
          collapsed ? 'justify-center px-0 py-2.5' : 'gap-2 px-2.5 py-2'
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-[#0078d4] text-white">
          <AzureGlyph name="plus" className="h-3.5 w-3.5" />
        </span>
        {!collapsed ? <span>Create a resource</span> : null}
      </a>

      <div className="mt-1.5 space-y-0.5">
        {fixedLinks.map((l, i) => {
          const active = pathname === l.href && i === 0 && !query;
          return (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? l.label : undefined}
              className={`group relative flex items-center rounded-md text-[13px] transition ${
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-[7px]'
              } ${active ? 'bg-[#eff6fc] font-semibold text-[#004578]' : 'text-[#323130] hover:bg-[#f3f2f1]'}`}
            >
              {active ? (
                <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-[#0078d4]" />
              ) : null}
              <span className="text-[#0078d4]">
                <AzureGlyph name={l.glyph} className="h-[18px] w-[18px]" />
              </span>
              {!collapsed ? <span className="truncate">{l.label}</span> : null}
            </a>
          );
        })}
      </div>

      <nav className="no-scrollbar mt-4 flex-1 space-y-4 overflow-y-auto pb-4">
        {Object.entries(groups).map(([group, items], gi) => (
          <div key={group}>
            {!collapsed ? (
              <p className="mb-1 flex items-center gap-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#605e5c]">
                {gi === 0 ? (
                  <AzureGlyph name="star" className="h-3 w-3 text-[#f2b100]" />
                ) : null}
                {gi === 0 ? 'Favorites' : group}
              </p>
            ) : (
              <div className="mx-auto mb-1 h-px w-6 bg-[#e1dfdd]" />
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item.href) && !query;
                const vis = moduleVisual(item.href);
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={`group relative flex items-center rounded-md text-[13px] transition ${
                        collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-[6px]'
                      } ${
                        active
                          ? 'bg-[#eff6fc] font-semibold text-[#004578]'
                          : 'text-[#323130] hover:bg-[#f3f2f1]'
                      }`}
                    >
                      {active ? (
                        <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-[#0078d4]" />
                      ) : null}
                      <ServiceIcon glyph={vis.glyph} color={vis.color} size="sm" />
                      {!collapsed ? (
                        <span className="truncate">{item.label}</span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f5f6fa] text-[#323130]">
      {/* Top command bar */}
      <header className="z-40 flex h-12 shrink-0 items-center gap-2 bg-gradient-to-r from-[#0b1f3a] via-[#0e2f52] to-[#123a63] px-2 text-white shadow-[0_1px_0_rgba(255,255,255,0.06)] md:px-3">
        <button
          type="button"
          onClick={onHamburger}
          className="flex h-9 w-9 items-center justify-center rounded text-slate-200 transition hover:bg-white/10"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          <AzureGlyph name="menu" className="h-5 w-5" />
        </button>

        <a href="/superadmin" className="flex items-center gap-2 pr-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-[#0078d4] text-[11px] font-bold shadow">
            HL
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-white sm:inline">
            HIGHLINK{' '}
            <span className="font-normal text-slate-300">Security Console</span>
          </span>
        </a>

        {/* Global search */}
        <div ref={searchRef} className="relative mx-auto hidden w-full max-w-xl md:block">
          <div className="flex items-center gap-2 rounded border border-white/10 bg-white/95 px-3 py-1.5 text-[13px] text-slate-600 shadow-sm focus-within:ring-2 focus-within:ring-sky-400/60">
            <AzureGlyph name="search" className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search modules, customers and resources"
              aria-label="Search modules, customers and resources"
              className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-500"
            />
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">
              G+/
            </kbd>
          </div>
          {searchOpen && query ? (
            <div className="absolute left-0 right-0 top-full mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-slate-800 shadow-xl">
              {searchResults.length ? (
                searchResults.map((r) => {
                  const vis = moduleVisual(r.href);
                  return (
                    <a
                      key={r.href}
                      href={r.href}
                      onClick={() => {
                        setSearchOpen(false);
                        setQuery('');
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-[#f3f9fd]"
                    >
                      <ServiceIcon glyph={vis.glyph} color={vis.color} size="sm" />
                      <span className="font-medium">{r.label}</span>
                      <span className="ml-auto text-[11px] text-slate-400">
                        {r.group}
                      </span>
                    </a>
                  );
                })
              ) : (
                <p className="px-3 py-3 text-[13px] text-slate-400">
                  No modules match “{query}”.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <span className="mr-1 hidden items-center gap-1.5 rounded bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white lg:inline-flex">
            <AzureGlyph name="sparkles" className="h-4 w-4 text-sky-300" />
            Copilot
          </span>
          {(
            [
              { g: 'terminal', label: 'Cloud Shell' },
              { g: 'bell', label: 'Notifications (unread)' },
              { g: 'gear', label: 'Settings' },
              { g: 'help', label: 'Help' },
            ] as const
          ).map(({ g, label }) => (
            <button
              key={g}
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded text-slate-200 transition hover:bg-white/10"
              aria-label={label}
            >
              <AzureGlyph name={g} className="h-[18px] w-[18px]" />
              {g === 'bell' ? (
                <span
                  className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-400"
                  aria-hidden
                />
              ) : null}
            </button>
          ))}
          <div className="ml-1.5 flex items-center gap-2 rounded pl-1 pr-1.5">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-[12px] font-semibold text-white">{userName}</p>
              <p className="text-[10.5px] text-slate-300">
                {userEmail ?? userRole ?? directory}
              </p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-[#0078d4] text-[11px] font-semibold text-white ring-2 ring-white/20">
              {initials}
            </span>
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
            >
              <AzureGlyph name="logout" className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside
          className={`hidden shrink-0 flex-col border-r border-[#e1dfdd] bg-white px-2 py-3 transition-[width] duration-200 ease-in-out md:flex ${
            collapsed ? 'w-[60px]' : 'w-64'
          } ${ready ? '' : 'opacity-0'}`}
        >
          {sidebarInner}
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div
            className="fixed inset-0 z-50 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMobileOpen(false);
            }}
          >
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-[#e1dfdd] bg-white px-2 py-3">
              {sidebarInner}
            </aside>
          </div>
        ) : null}

        <main className="admin-portal-main min-w-0 flex-1 overflow-auto p-4 md:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}


type ExternalPortalShellProps = {
  userName: string;
  entityName?: string;
  brand?: string;
  mobileLabel?: string;
  nav: NavItem[];
  pathname: string;
  onLogout: () => void;
  children: ReactNode;
};

/** Thin shell for external customer/supplier portals (mirrors AdminShell layout). */
function ExternalPortalShell({
  userName,
  entityName,
  brand = 'HIGHLINK Customer',
  mobileLabel = 'Customer Portal',
  nav,
  pathname,
  onLogout,
  children,
}: ExternalPortalShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'HL';

  const segment = brand.replace(/^HIGHLINK\s*/i, '').trim() || 'Portal';

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const sidebarInner = (
    <>
      <div className="px-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0067b8]">
          {brand}
        </p>
        <p className="mt-1 truncate text-[13px] font-medium text-[#323130]">
          {userName}
        </p>
        {entityName ? (
          <p className="truncate text-[11px] text-[#605e5c]">{entityName}</p>
        ) : null}
      </div>
      <nav className="mt-5 flex-1 overflow-y-auto pb-4">
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition ${
                    active
                      ? 'bg-[#eff6fc] font-semibold text-[#004578]'
                      : 'text-[#323130] hover:bg-[#f3f2f1]'
                  }`}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-[#0078d4]" />
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f5f6fa] text-[#323130]">
      {/* Top command bar */}
      <header className="z-40 flex h-12 shrink-0 items-center gap-2 bg-gradient-to-r from-[#0b1f3a] via-[#0e2f52] to-[#123a63] px-2 text-white shadow-[0_1px_0_rgba(255,255,255,0.06)] md:px-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded text-slate-200 transition hover:bg-white/10 md:hidden"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <AzureGlyph name="menu" className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 pr-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-[#0078d4] text-[11px] font-bold shadow">
            HL
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-white sm:inline">
            HIGHLINK{' '}
            <span className="font-normal text-slate-300">{segment} Portal</span>
          </span>
          <span className="text-[13px] text-slate-200 sm:hidden">
            {mobileLabel}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[12px] font-semibold text-white">{userName}</p>
            {entityName ? (
              <p className="text-[10.5px] text-slate-300">{entityName}</p>
            ) : null}
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-[#0078d4] text-[11px] font-semibold text-white ring-2 ring-white/20">
            {initials}
          </span>
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <AzureGlyph name="logout" className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-[#e1dfdd] bg-white px-2 py-4 md:flex">
          {sidebarInner}
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div
            className="fixed inset-0 z-50 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMobileOpen(false);
            }}
          >
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-[#e1dfdd] bg-white px-2 py-4">
              {sidebarInner}
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Thin shell for external customer portal (mirrors AdminShell layout). */
export function CustomerShell({
  userName,
  customerName,
  brand,
  nav,
  pathname,
  onLogout,
  children,
}: {
  userName: string;
  customerName?: string;
  brand?: string;
  nav: NavItem[];
  pathname: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <ExternalPortalShell
      userName={userName}
      entityName={customerName}
      brand={brand ?? 'HIGHLINK Customer'}
      mobileLabel="Customer Portal"
      nav={nav}
      pathname={pathname}
      onLogout={onLogout}
    >
      {children}
    </ExternalPortalShell>
  );
}

/** Thin shell for external supplier portal. */
export function SupplierShell({
  userName,
  supplierName,
  nav,
  pathname,
  onLogout,
  children,
}: {
  userName: string;
  supplierName?: string;
  nav: NavItem[];
  pathname: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <ExternalPortalShell
      userName={userName}
      entityName={supplierName}
      brand="HIGHLINK Supplier"
      mobileLabel="Supplier Portal"
      nav={nav}
      pathname={pathname}
      onLogout={onLogout}
    >
      {children}
    </ExternalPortalShell>
  );
}

/** Thin shell for parking ops portal. */
export function ParkingShell({
  userName,
  nav,
  pathname,
  onLogout,
  children,
}: {
  userName: string;
  nav: NavItem[];
  pathname: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <ExternalPortalShell
      userName={userName}
      brand="HIGHLINK Parking"
      mobileLabel="Parking Portal"
      nav={nav}
      pathname={pathname}
      onLogout={onLogout}
    >
      {children}
    </ExternalPortalShell>
  );
}
