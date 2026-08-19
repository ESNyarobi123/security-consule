'use client';

import {
  getPlatformServicesHealth,
  type PlatformServiceHealth,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { GlassCard, btnSecondary } from '@pssms/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatApiError } from '../_components/shared';

export default function SuperAdminIntegrationsPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canProbe = can(session, 'integrations.manage');
  const [services, setServices] = useState<PlatformServiceHealth[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!canProbe) return;
    setLoading(true);
    setError(null);
    try {
      const health = await getPlatformServicesHealth();
      setServices(health.services);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [canProbe]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1a19]">Integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#605e5c]">
          Super Admin oversight of adapters, webhooks, outbox, and service
          health. Mutating integration config stays on the Developer portal
          (integrations.manage).
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/developer" className="text-[#0078d4]">
          Developer overview
        </Link>
        <Link href="/developer/health" className="text-[#0078d4]">
          Health
        </Link>
        <Link href="/developer/webhooks" className="text-[#0078d4]">
          Webhooks
        </Link>
        <Link href="/developer/outbox" className="text-[#0078d4]">
          Outbox
        </Link>
      </div>
      {canProbe ? (
        <>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void refresh()}
            disabled={loading}
          >
            Refresh probes
          </button>
          {error ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {error}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <GlassCard key={s.code} glow="none" className="p-4">
                <p className="text-sm font-semibold">{s.name ?? s.code}</p>
                <p className="mt-1 text-xs uppercase text-[#605e5c]">
                  {s.status}
                </p>
              </GlassCard>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-[#605e5c]">
          Live probes require integrations.manage. ICT can still open Developer
          links above when that permission is granted.
        </p>
      )}
    </div>
  );
}
