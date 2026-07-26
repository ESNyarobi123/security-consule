'use client';

import type { EdgeGateway } from '@pssms/api-client';
import { Activity, Clock, Hash, Router } from 'lucide-react';
import {
  WALL,
  isGatewayOnline,
  relativeTime,
  statusTone,
} from './shared';

export function GatewayCard({
  gateway,
  siteLabel,
}: {
  gateway: EdgeGateway;
  siteLabel?: string;
}) {
  const online = isGatewayOnline(gateway.status);
  const tone = statusTone(gateway.status);

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-xl transition duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{
        background: `linear-gradient(160deg, ${WALL.panel} 0%, #0d1f35 100%)`,
        border: `1px solid ${online ? 'rgba(52, 211, 153, 0.35)' : WALL.borderStrong}`,
      }}
    >
      {online ? (
        <span
          className="absolute right-3 top-3 flex h-2.5 w-2.5"
          title="Online"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
      ) : null}

      <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-inner ring-2 ring-white/10"
            style={{
              background: online
                ? 'linear-gradient(145deg, #34d399 0%, #0e7490 55%, #0078d4 100%)'
                : 'linear-gradient(145deg, #38bdf8 0%, #0078d4 55%, #0e7490 100%)',
            }}
          >
            <Router className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pr-4">
            <p className="truncate text-sm font-semibold text-white">
              {gateway.name}
            </p>
            <p
              className="mt-0.5 font-mono text-[11px]"
              style={{ color: WALL.muted }}
            >
              {gateway.code}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${tone.className}`}
              >
                {tone.label}
              </span>
              {gateway.version ? (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200 ring-1 ring-sky-400/25">
                  <Hash className="h-3 w-3" />
                  v{gateway.version}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md bg-slate-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-slate-400/20">
                  No version
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className="mt-3 space-y-1.5 text-[12px]"
          style={{ color: WALL.muted }}
        >
          <p className="flex items-center gap-1.5 truncate">
            <Activity className="h-3.5 w-3.5 shrink-0 opacity-70" />
            {siteLabel || 'Unassigned site'}
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
            Heartbeat {relativeTime(gateway.lastHeartbeatAt)}
          </p>
        </div>
      </div>
    </article>
  );
}
