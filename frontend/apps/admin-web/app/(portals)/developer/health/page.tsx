'use client';

import { getPlatformServicesHealth, type PlatformServiceHealth } from '@pssms/api-client';
import { btnSecondary } from '@pssms/ui';
import { RefreshCw, Server } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';
import { PanelEmpty, ServiceCard } from '../_components/shared';

export default function DeveloperHealthPage() {
  const [services, setServices] = useState<PlatformServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const health = await getPlatformServicesHealth();
      setServices(health.services);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const deployed = services.filter((s) => s.status !== 'not_deployed');
  const absent = services.filter((s) => s.status === 'not_deployed');

  return (
    <DeveloperShell
      title="Service health"
      description="Live probes for core APIs, workers, gateways, and AI services. Services this deployment does not run are listed separately instead of being reported as down."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {loading && services.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-[#e1dfdd] bg-white"
            />
          ))}
        </div>
      ) : services.length === 0 ? (
        <PanelEmpty
          icon={<Server className="h-4 w-4" />}
          title="No services reported"
          description="Health probes returned an empty list."
        />
      ) : (
        <div className="space-y-5">
          <p className="rounded-md border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs text-[#605e5c]">
            {deployed.filter((s) => s.status === 'ok').length}/
            {deployed.length} deployed services responding
            {absent.length
              ? ` · ${absent.length} service(s) are not running in this environment (grey). They are not failures.`
              : ''}
          </p>
          <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
              Deployed services
            </h2>
            {deployed.length === 0 ? (
              <PanelEmpty
                icon={<Server className="h-4 w-4" />}
                title="No deployed services"
                description="Every probe target is marked absent for this environment."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {deployed.map((row) => (
                  <ServiceCard key={row.code} row={row} />
                ))}
              </div>
            )}
          </div>
          {absent.length ? (
            <div>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                Not running in this environment
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {absent.map((row) => (
                  <ServiceCard key={row.code} row={row} />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[#8a8886]">
                Start the service, or point its URL env var at where it runs, to
                probe it. Nothing here is broken — it is simply not part of this
                install.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </DeveloperShell>
  );
}
