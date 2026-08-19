'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';

function IconBook({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function IconCheck({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function IconShield({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function IconMenu({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

export function VisitorShell({
  children,
  title,
  active = 'book',
}: {
  children: ReactNode;
  title: string;
  active?: 'book' | 'success';
}) {
  const [open, setOpen] = useState(false);

  const nav = (
    <>
      <div className="mb-8 px-1">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb] text-sm font-bold text-white">
            HL
          </span>
          <div>
            <p className="font-display text-base font-bold tracking-tight text-slate-900">
              HIGHLINK
            </p>
          <p className="text-[11px] font-medium text-slate-500">Visitor appointment</p>
          </div>
        </div>
      </div>

      <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        Navigation
      </p>
      <nav className="space-y-0.5">
        <Link
          href="/"
          className="hl-nav-link"
          data-active={active === 'book' ? 'true' : 'false'}
          onClick={() => setOpen(false)}
        >
          <IconBook />
          Book visit
        </Link>
        <Link
          href={active === 'success' ? '#' : '/#how'}
          className="hl-nav-link"
          data-active={active === 'success' ? 'true' : 'false'}
          onClick={() => setOpen(false)}
        >
          <IconCheck />
          {active === 'success' ? 'Confirmation' : 'How it works'}
        </Link>
      </nav>

      <p className="mb-2 mt-8 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        Info
      </p>
      <div className="space-y-0.5 px-1">
        <div className="hl-nav-link pointer-events-none opacity-80">
          <IconShield />
          Host approval required
        </div>
      </div>

      <div className="mt-auto border-t border-slate-200 pt-4">
        <p className="px-2 text-[11px] leading-relaxed text-slate-400">
          Gate code is issued only after your host approves. Guests, contractors,
          consultants, candidates, and suppliers use this form — it is never
          shown here.
        </p>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh w-full bg-white">
      {/* Desktop sidebar — fixed width, full height */}
      <aside className="no-print sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-slate-200 bg-[#f1f5f9] px-4 py-6 lg:flex xl:w-[260px]">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/30"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(280px,85vw)] flex-col bg-[#f1f5f9] px-4 py-6 shadow-xl">
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center gap-3 border-b border-slate-100 px-4 py-3 lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <IconMenu />
          </button>
          <div>
            <p className="text-sm font-bold text-slate-900">HIGHLINK</p>
            <p className="text-[11px] text-slate-500">Visitor appointment</p>
          </div>
        </header>

        {/* Full-bleed main — no max-width column gaps */}
        <main className="w-full flex-1 px-4 py-6 sm:px-6 md:px-8 lg:px-10 lg:py-8 xl:px-12">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          {children}
        </main>
      </div>
    </div>
  );
}
