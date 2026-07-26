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

  return (
    <DeveloperShell
      title="Service health"
      description="Live probes for core APIs, workers, gateways, and AI services."
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((row) => (
            <ServiceCard key={row.code} row={row} />
          ))}
        </div>
      )}
    </DeveloperShell>
  );
}
