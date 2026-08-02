'use client';

import {
  getCustomerPortalIncidents,
  listCustomerInvoices,
  listCustomerVisitors,
} from '@pssms/api-client';
import type { NavItem } from '@pssms/permissions';
import {
  AzureGlyph,
  ServiceIcon,
  moduleVisual,
} from '@pssms/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

const SIDEBAR_KEY = 'pssms_customer_sidebar';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CP';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function CustomerPortalShell({
  userName,
  customerName,
  customerCode,
  nav,
  pathname,
  onLogout,
  children,
}: {
  userName: string;
  customerName?: string;
  customerCode?: string;
  nav: NavItem[];
  pathname: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved === 'collapsed') setCollapsed(true);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [invoices, visitors, incidents] = await Promise.all([
          listCustomerInvoices().catch(() => []),
          listCustomerVisitors().catch(() => []),
          getCustomerPortalIncidents().catch(() => []),
        ]);
        if (cancelled) return;
        let n = 0;
        for (const inv of invoices) {
          const s = inv.status.toUpperCase();
          if (
            s.includes('OVERDUE') ||
            s.includes('SENT') ||
            s.includes('PARTIAL')
          ) {
            n += 1;
          }
        }
        for (const v of visitors) {
          if (v.status.toUpperCase() === 'PENDING') n += 1;
        }
        for (const inc of incidents) {
          const s = inc.status.toUpperCase();
          if (s === 'OPEN' || s === 'INVESTIGATING') n += 1;
        }
        setAlertCount(n);
      } catch {
        if (!cancelled) setAlertCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded');
      return next;
    });
  }

  /** Desktop: collapse/expand. Mobile: open drawer. */
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

  const groups = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of nav) {
      const g = item.group ?? 'Other';
      const list = map.get(g) ?? [];
      list.push(item);
      map.set(g, list);
    }
    return [...map.entries()];
  }, [nav]);

  const isActive = (href: string) =>
    pathname === href ||
    (pathname.startsWith(`${href}/`) &&
      !nav.some(
        (other) =>
          other.href !== href &&
          other.href.startsWith(`${href}/`) &&
          (pathname === other.href || pathname.startsWith(`${other.href}/`)),
      ));

  function renderSidebar(opts: { collapsed: boolean; onNavigate?: () => void }) {
    const { collapsed: slim, onNavigate } = opts;
    return (
      <>
        {!slim ? (
          <div className="px-2.5 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0067b8]">
              Customer portal
            </p>
            <p className="mt-1 truncate text-[13px] font-semibold text-[#323130]">
              {customerName ?? 'Your organisation'}
            </p>
            {customerCode ? (
              <p className="truncate font-mono text-[11px] text-[#605e5c]">
                {customerCode}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mb-2 flex justify-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-[#0078d4] text-[10px] font-bold text-white">
              HL
            </span>
          </div>
        )}

        <Link
          href="/dashboard"
          onClick={onNavigate}
          title={slim ? 'Overview' : undefined}
          className={`flex items-center rounded-md text-[13px] font-semibold text-[#0067b8] transition hover:bg-[#f3f2f1] ${
            slim ? 'justify-center px-0 py-2.5' : 'gap-2 px-2.5 py-2'
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-[#0078d4] text-white">
            <AzureGlyph name="home" className="h-3.5 w-3.5" />
          </span>
          {!slim ? <span>Overview</span> : null}
        </Link>

        <nav className="no-scrollbar mt-3 flex-1 space-y-4 overflow-y-auto pb-4">
          {groups.map(([group, items], gi) => (
            <div key={group}>
              {!slim ? (
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
                  const active = isActive(item.href);
                  const vis = moduleVisual(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={slim ? item.label : undefined}
                        onClick={onNavigate}
                        className={`group relative flex items-center rounded-md text-[13px] transition ${
                          slim
                            ? 'justify-center px-0 py-2'
                            : 'gap-2.5 px-2.5 py-[6px]'
                        } ${
                          active
                            ? 'bg-[#eff6fc] font-semibold text-[#004578]'
                            : 'text-[#323130] hover:bg-[#f3f2f1]'
                        }`}
                      >
                        {active ? (
                          <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-[#0078d4]" />
                        ) : null}
                        <ServiceIcon
                          glyph={vis.glyph}
                          color={vis.color}
                          size="sm"
                        />
                        {!slim ? (
                          <span className="truncate">{item.label}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f5f6fa] text-[#323130]">
      <header className="z-40 flex h-12 shrink-0 items-center gap-2 bg-gradient-to-r from-[#0b1f3a] via-[#0e2f52] to-[#123a63] px-2 text-white shadow-[0_1px_0_rgba(255,255,255,0.06)] md:px-3">
        <button
          type="button"
          onClick={onHamburger}
          className="flex h-9 w-9 items-center justify-center rounded text-slate-200 transition hover:bg-white/10"
          aria-label={
            collapsed ? 'Expand navigation menu' : 'Collapse navigation menu'
          }
          aria-expanded={!collapsed || mobileOpen}
          title="Toggle sidebar"
        >
          <AzureGlyph name="menu" className="h-5 w-5" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2 pr-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-[#0078d4] text-[11px] font-bold shadow">
            HL
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-white sm:inline">
            HIGHLINK{' '}
            <span className="font-normal text-slate-300">Customer Portal</span>
          </span>
          <span className="text-[13px] text-slate-200 sm:hidden">Portal</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label={
              alertCount > 0 ? `Alerts (${alertCount})` : 'Alerts'
            }
            title={
              alertCount > 0 ? `${alertCount} open alert(s)` : 'No open alerts'
            }
          >
            <AzureGlyph name="bell" className="h-[18px] w-[18px]" />
            {alertCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-400 px-1 text-[9px] font-bold text-[#0b1f3a]">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            ) : null}
          </Link>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[12px] font-semibold text-white">{userName}</p>
            {customerName ? (
              <p className="max-w-[180px] truncate text-[10.5px] text-slate-300">
                {customerName}
              </p>
            ) : null}
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-[#0078d4] text-[11px] font-semibold text-white ring-2 ring-white/20">
            {initials(userName)}
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
        <aside
          className={`hidden shrink-0 flex-col border-r border-[#e1dfdd] bg-white px-2 py-3 transition-[width] duration-200 ease-in-out md:flex ${
            collapsed ? 'w-[60px]' : 'w-64'
          } ${ready ? '' : 'opacity-0'}`}
        >
          {renderSidebar({ collapsed })}
        </aside>

        {mobileOpen ? (
          <div
            className="fixed inset-0 z-50 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-[#e1dfdd] bg-white px-2 py-3 shadow-xl">
              {renderSidebar({
                collapsed: false,
                onNavigate: () => setMobileOpen(false),
              })}
            </aside>
          </div>
        ) : null}

        <main className="no-scrollbar min-w-0 flex-1 overflow-auto p-3 sm:p-4 md:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
