'use client';

import { getMarketingReports, type MarketingReport } from '@pssms/api-client';
import { GlassCard, StatCard, btnSecondary } from '@pssms/ui';
import {
  ClipboardList,
  Megaphone,
  RefreshCw,
  Target,
  Trophy,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const TOPICS: { title: string; href: string; description: string }[] = [
  {
    title: 'Sales pipeline',
    href: '/marketing/pipeline',
    description:
      'Leads, site surveys, quotations, proposals, win/lose, convert to customer + DRAFT contract',
  },
  {
    title: 'Campaigns',
    href: '/marketing/campaigns',
    description:
      'Named lead sources with live attribution: leads, won, pipeline value, conversion',
  },
  {
    title: 'Referral commissions',
    href: '/marketing/commissions',
    description:
      'PENDING → ACCRUED → PAID register; second officer accrues; Finance pays via 35.15',
  },
  {
    title: 'Contract approval',
    href: '/approvals',
    description:
      'Legal → GM → CEO → CMD — marketing cannot approve own convert',
  },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

const STAGE_ORDER = [
  'LEAD',
  'QUALIFIED',
  'SURVEY_SCHEDULED',
  'SURVEY_DONE',
  'QUOTED',
  'PROPOSAL',
  'WON',
  'LOST',
];

export default function MarketingOverviewPage() {
  const [pack, setPack] = useState<MarketingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getMarketingReports());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load marketing overview',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxStage = Math.max(
    1,
    ...STAGE_ORDER.map((s) => pack?.byStage?.[s] ?? 0),
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0078d4]">
            Portal 35.19 · Marketing &amp; Business Development
          </p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[#1b1a19] md:text-[30px]">
            Leads to signed work
          </h1>
          <p className="mt-1 max-w-3xl text-[13px] text-[#605e5c]">
            Used by Marketing / BD / sales officers on the seeded{' '}
            <code className="text-[11px]">MARKETING</code> role (
            <code className="text-[11px]">marketing1@</code>). Referral partners
            are named on the lead. Branch Managers stay Field Ops.
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open pipeline"
          value={loading ? '…' : (pack?.openPipeline ?? 0)}
          hint={`${fmt(pack?.pipelineValue ?? 0)} estimated`}
          icon={<ClipboardList className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Won"
          value={loading ? '…' : (pack?.won ?? 0)}
          hint={`${fmt(pack?.wonValue ?? 0)} · ${pack?.lost ?? 0} lost`}
          icon={<Trophy className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Conversion"
          value={loading ? '…' : `${pack?.conversionRate ?? 0}%`}
          hint={`${pack?.totalLeads ?? 0} leads · ${pack?.quotesAccepted ?? 0} accepted quotes`}
          icon={<Target className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Campaigns"
          value={loading ? '…' : (pack?.activeCampaigns ?? 0)}
          hint={`${pack?.surveysScheduled ?? 0} surveys scheduled`}
          icon={<Megaphone className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Commissions pending"
          value={loading ? '…' : fmt(pack?.pendingCommissionAmount ?? 0)}
          hint={`${pack?.pendingCommissions ?? 0} rows awaiting accrual`}
          icon={<Wallet className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Commissions accrued"
          value={loading ? '…' : fmt(pack?.accruedCommissionAmount ?? 0)}
          hint="Approved by a second officer, awaiting payment"
          icon={<Wallet className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Commissions paid"
          value={loading ? '…' : fmt(pack?.paidCommissionAmount ?? 0)}
          hint="Marked paid with a Finance reference"
          icon={<Wallet className="h-5 w-5" />}
          accent="emerald"
        />
      </div>

      {pack ? (
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1b1a19]">
              Pipeline by stage
            </p>
            <Link
              href="/marketing/pipeline"
              className="text-xs font-medium text-[#0078d4]"
            >
              Open pipeline →
            </Link>
          </div>
          <div className="space-y-2">
            {STAGE_ORDER.map((s) => {
              const count = pack.byStage?.[s] ?? 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-36 text-xs text-[#605e5c]">{s}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f3f2f1]">
                    <div
                      className="h-full rounded-full bg-[#0078d4]"
                      style={{ width: `${(count / maxStage) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-[#1b1a19]">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {TOPICS.map((t) => (
          <Link key={t.href} href={t.href}>
            <GlassCard className="h-full p-4 transition hover:ring-1 hover:ring-[#0078d4]/30">
              <p className="text-sm font-semibold text-[#1b1a19]">{t.title}</p>
              <p className="mt-1 text-xs text-[#605e5c]">{t.description}</p>
            </GlassCard>
          </Link>
        ))}
      </div>

      {pack?.notes?.length ? (
        <p className="flex items-start gap-2 text-xs text-[#605e5c]">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {pack.notes.join(' ')}
        </p>
      ) : null}
    </div>
  );
}
