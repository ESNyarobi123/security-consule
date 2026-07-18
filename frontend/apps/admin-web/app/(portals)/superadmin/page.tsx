'use client';

import {
  listContracts,
  listCustomers,
  listEmployees,
  listGuards,
  listInvoices,
  type Contract,
  type Customer,
  type Employee,
  type Guard,
  type Invoice,
} from '@pssms/api-client';
import {
  CategorySection,
  ConsoleSectionHeader,
  GlassCard,
  type GlyphName,
  MetricStatCard,
  QuickTile,
  ServiceTile,
  moduleVisual,
} from '@pssms/ui';
import {
  Building2,
  FileText,
  Receipt,
  Users,
  UserSquare2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

// ── Azure-style quick access (top service row) ──
const QUICK: { title: string; href: string }[] = [
  { title: 'Customers', href: '/superadmin/customers' },
  { title: 'Contracts', href: '/superadmin/contracts' },
  { title: 'Guards', href: '/operations/guards' },
  { title: 'HR', href: '/hr' },
  { title: 'Finance', href: '/finance' },
  { title: 'Operations', href: '/operations' },
  { title: 'Approvals', href: '/approvals' },
  { title: 'Compliance', href: '/compliance' },
];

// ── Services catalog (Azure "all services" categories) ──
type CatalogItem = {
  title: string;
  href: string;
  description: string;
  badge?: string;
  external?: boolean;
  glyph?: GlyphName;
  color?: string;
};

const CATALOG: { category: string; items: CatalogItem[] }[] = [
  {
    category: 'Customers & Contracts',
    items: [
      { title: 'Customers', href: '/superadmin/customers', description: 'Client organizations, sites & contacts' },
      { title: 'Contracts', href: '/superadmin/contracts', description: 'SLAs, pricing, renewals & termination' },
      { title: 'Marketing', href: '/marketing', description: 'Leads, campaigns & customer growth' },
      { title: 'Call Centre', href: '/callcentre', description: 'Visitor bookings & customer service' },
    ],
  },
  {
    category: 'People & Workforce',
    items: [
      { title: 'HR', href: '/hr', description: 'Employees, leave, discipline & training' },
      { title: 'Payroll', href: '/payroll', description: 'Company & customer payroll snapshots' },
      { title: 'Guards', href: '/operations/guards', description: 'Guard registry, status & deployment' },
      { title: 'Recruitment', href: 'http://localhost:3004', external: true, badge: 'Portal', description: 'Applicant screening & interviews', glyph: 'user-check', color: '#65a30d' },
    ],
  },
  {
    category: 'Operations & Field',
    items: [
      { title: 'Ops Console', href: '/operations', description: 'Deployment, shifts & control room' },
      { title: 'CCTV & AI', href: '/cctv', description: 'Surveillance analytics, ANPR & OCR' },
      { title: 'Branch Ops', href: '/branch', description: 'Branch-level operations & sites' },
      { title: 'Approvals', href: '/approvals', description: 'Creator ≠ approver workflow engine' },
    ],
  },
  {
    category: 'Finance & Billing',
    items: [
      { title: 'Finance', href: '/finance', description: 'Invoices, receipts & reconciliation' },
      { title: 'Procurement', href: '/procurement', description: 'Suppliers, POs, GRN & assets' },
    ],
  },
  {
    category: 'Governance & Platform',
    items: [
      { title: 'Compliance', href: '/compliance', description: 'DPO, audit, risk & breach management' },
      { title: 'Developer', href: '/developer', description: 'Service health, webhooks & integrations' },
      { title: 'Executive', href: 'http://localhost:3001', external: true, badge: 'External', description: 'CMD / CEO / GM executive dashboards', glyph: 'file-chart', color: '#0284c7' },
    ],
  },
];

export default function SuperadminPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(
    Object.fromEntries(CATALOG.map((c) => [c.category, true])),
  );

  useEffect(() => {
    void Promise.all([
      listCustomers().catch(() => [] as Customer[]),
      listContracts().catch(() => [] as Contract[]),
      listGuards().catch(() => [] as Guard[]),
      listEmployees().catch(() => [] as Employee[]),
      listInvoices().catch(() => [] as Invoice[]),
    ]).then(([c, ct, g, e, inv]) => {
      setCustomers(c);
      setContracts(ct);
      setGuards(g);
      setEmployees(e);
      setInvoices(inv);
      setLoading(false);
    });
  }, []);

  const openInvoices = useMemo(
    () =>
      invoices.filter((i) => i.status !== 'PAID' && i.status !== 'VOIDED')
        .length,
    [invoices],
  );

  const empty =
    !loading &&
    customers.length + contracts.length + guards.length + invoices.length === 0;

  // Filtered catalog (search across all categories)
  const q = filter.trim().toLowerCase();
  const filteredCatalog = CATALOG.map((cat) => ({
    ...cat,
    items: q
      ? cat.items.filter(
          (it) =>
            it.title.toLowerCase().includes(q) ||
            it.description.toLowerCase().includes(q) ||
            cat.category.toLowerCase().includes(q),
        )
      : cat.items,
  })).filter((cat) => cat.items.length > 0);
  const totalServices = CATALOG.reduce((s, c) => s + c.items.length, 0);

  function tileVisual(it: CatalogItem): { glyph: GlyphName; color: string } {
    if (it.glyph && it.color) return { glyph: it.glyph, color: it.color };
    return moduleVisual(it.href);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header strip */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0078d4]">
            Platform command
          </p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[#1b1a19] md:text-[30px]">
            HIGHLINK Console
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-[#605e5c]">
            Live snapshot across customers, contracts, field force, billing and
            governance — plus every module in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c7e0f4] bg-[#eff6fc] px-3 py-1 text-[11px] font-medium text-[#0067b8]">
            <span
              className={`h-1.5 w-1.5 rounded-full bg-[#0078d4] ${loading ? 'animate-pulse' : ''}`}
            />
            {loading ? 'Syncing live data…' : 'Live data'}
          </span>
          <Link
            href="/superadmin/customers"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0078d4] px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-[#106ebe]"
          >
            + Manage customers
          </Link>
        </div>
      </div>

      {empty ? (
        <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No records returned from the API yet. If you were idle, your session
          may have refreshed — reload the page. Otherwise seed data with{' '}
          <code className="rounded bg-amber-100 px-1">npm run prisma:seed</code>.
        </div>
      ) : null}

      {/* KPI row — the "card box" (all real counts) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link href="/superadmin/customers" className="block h-full">
          <MetricStatCard label="Customers" value={customers.length} accent="sky" icon={<Building2 className="h-5 w-5" />} />
        </Link>
        <Link href="/superadmin/contracts" className="block h-full">
          <MetricStatCard label="Contracts" value={contracts.length} accent="violet" icon={<FileText className="h-5 w-5" />} />
        </Link>
        <Link href="/operations/guards" className="block h-full">
          <MetricStatCard label="Guards" value={guards.length} accent="emerald" icon={<Users className="h-5 w-5" />} />
        </Link>
        <Link href="/hr" className="block h-full">
          <MetricStatCard label="Employees" value={employees.length} accent="amber" icon={<UserSquare2 className="h-5 w-5" />} />
        </Link>
        <Link href="/finance" className="block h-full">
          <MetricStatCard label="Open invoices" value={openInvoices} accent="rose" icon={<Receipt className="h-5 w-5" />} />
        </Link>
      </div>

      {/* Quick access — Azure services row */}
      <GlassCard glow="none">
        <ConsoleSectionHeader title="HIGHLINK services" action={{ label: 'All services', href: '#catalog' }} />
        <div className="flex gap-1 overflow-x-auto pb-1">
          <Link
            href="/superadmin/customers"
            className="group flex w-[104px] shrink-0 flex-col items-center gap-2 rounded-xl border border-dashed border-[#c7e0f4] px-2 py-3 text-center transition hover:border-[#0078d4] hover:bg-[#f3f9fd]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#eff6fc] text-[#0078d4]">
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span className="text-[11.5px] font-medium leading-tight text-[#0067b8] group-hover:underline">
              Create a resource
            </span>
          </Link>
          {QUICK.map((item) => {
            const vis = moduleVisual(item.href);
            return <QuickTile key={item.href} title={item.title} href={item.href} glyph={vis.glyph} color={vis.color} />;
          })}
        </div>
      </GlassCard>

      {/* Services catalog */}
      <GlassCard glow="none">
        <div id="catalog" className="scroll-mt-16" />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1b1a19]">All services</h2>
            <p className="text-[12px] text-[#605e5c]">
              {q ? `${filteredCatalog.reduce((s, c) => s + c.items.length, 0)} of ${totalServices}` : totalServices} modules
            </p>
          </div>
          <label className="flex w-full max-w-xs items-center gap-2 rounded-md border border-[#8a8886] bg-white px-3 py-1.5 text-[13px] focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-[#605e5c]"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" /></svg>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter services"
              aria-label="Filter services"
              className="w-full bg-transparent text-[#323130] outline-none placeholder:text-[#605e5c]"
            />
          </label>
        </div>

        <div className="space-y-4">
          {filteredCatalog.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#605e5c]">
              No modules match “{filter}”.
            </p>
          ) : (
            filteredCatalog.map((cat) => (
              <CategorySection
                key={cat.category}
                title={cat.category}
                count={cat.items.length}
                open={q ? true : (openCats[cat.category] ?? true)}
                onToggle={() =>
                  setOpenCats((prev) => ({
                    ...prev,
                    [cat.category]: !(prev[cat.category] ?? true),
                  }))
                }
              >
                {cat.items.map((it) => {
                  const vis = tileVisual(it);
                  return (
                    <ServiceTile
                      key={it.title}
                      title={it.title}
                      description={it.description}
                      href={it.href}
                      glyph={vis.glyph}
                      color={vis.color}
                      badge={it.badge}
                      external={it.external}
                    />
                  );
                })}
              </CategorySection>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}
