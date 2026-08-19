'use client';

import { GlassCard } from '@pssms/ui';
import Link from 'next/link';

export default function SuperAdminBackupsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1a19]">Backups</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#605e5c]">
          Design §35.1 / §32 requires backup and DR evidence. This portal does
          not invent a restore console. Production data lives on PostgreSQL and
          MinIO volumes; application seed is off in production deploy.
        </p>
      </div>
      <GlassCard glow="none" className="p-4">
        <h2 className="text-sm font-semibold">What exists today</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#323130]">
          <li>PostgreSQL volume on the production compose stack</li>
          <li>MinIO object store (`pssms-documents`) for evidence files</li>
          <li>Append-only audit log (not a backup)</li>
          <li>
            Careful deploy script migrates without seeding (`PSSMS_RUN_SEED=false`)
          </li>
        </ul>
      </GlassCard>
      <GlassCard glow="none" className="p-4">
        <h2 className="text-sm font-semibold">Deferred (honest)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#605e5c]">
          <li>Scheduled dump / off-site copy with restore drill evidence</li>
          <li>DPO backup attestation pack</li>
          <li>One-click restore from this portal</li>
        </ul>
        <p className="mt-3 text-sm">
          Service health (when permitted) is on{' '}
          <Link href="/superadmin/integrations" className="text-[#0078d4]">
            Integrations
          </Link>
          .
        </p>
      </GlassCard>
    </div>
  );
}
