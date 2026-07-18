'use client';

import {
  checkServiceHealth,
  listAnprResults,
  type AnprResult,
} from '@pssms/api-client';
import {
  btnSecondary,
  DataTable,
  GlassCard,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
} from '@pssms/ui';
import {
  Ban,
  CheckCircle2,
  RotateCw,
  ScanLine,
  ShieldAlert,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const VISION_URL = 'http://localhost:8000';

const isAllow = (d?: string | null) =>
  d != null && ['ALLOW', 'ALLOWED'].includes(d.toUpperCase());
const isDeny = (d?: string | null) =>
  d != null && ['DENY', 'DENIED'].includes(d.toUpperCase());

export default function CctvPage() {
  const [vision, setVision] = useState('…');
  const [rows, setRows] = useState<AnprResult[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [health, anpr] = await Promise.all([
        checkServiceHealth(VISION_URL, '/health'),
        listAnprResults().catch(() => [] as AnprResult[]),
      ]);
      setVision(health.status);
      setRows(anpr);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const online = vision !== '…' && vision.toLowerCase() !== 'down';

  const kpis = useMemo(() => {
    const allowed = rows.filter((r) => isAllow(r.decision)).length;
    const denied = rows.filter((r) => isDeny(r.decision)).length;
    const pending = rows.length - allowed - denied;
    return { total: rows.length, allowed, denied, pending };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="CCTV monitoring"
        description="Vision-AI health and ANPR events — video stays on NVR/MinIO."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={btnSecondary}
          >
            <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Vision-AI service"
          value={loading ? '…' : online ? 'Online' : 'Offline'}
          hint={online ? 'ANPR pipeline reachable' : 'Endpoint unreachable'}
          accent={online ? 'emerald' : 'rose'}
          icon={<Video className="h-5 w-5" />}
        />
        <StatCard
          label="ANPR events"
          value={kpis.total}
          hint={
            kpis.pending > 0
              ? `${kpis.pending.toLocaleString('en-TZ')} awaiting decision`
              : 'Plate captures on record'
          }
          accent="blue"
          icon={<ScanLine className="h-5 w-5" />}
        />
        <StatCard
          label="Allowed"
          value={kpis.allowed}
          hint={
            kpis.total > 0
              ? `${Math.round((kpis.allowed / kpis.total) * 100)}% of events`
              : 'No events yet'
          }
          accent="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Denied"
          value={kpis.denied}
          hint={
            kpis.total > 0
              ? `${Math.round((kpis.denied / kpis.total) * 100)}% of events`
              : 'No events yet'
          }
          accent="rose"
          icon={<Ban className="h-5 w-5" />}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Service health</SectionTitle>
        <GlassCard glow={online ? 'emerald' : 'rose'}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  online
                    ? 'bg-[#dff6dd] text-[#107c10]'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1b1a19]">
                  vision-ai-service
                </p>
                <p className="text-xs text-[#605e5c]">
                  {VISION_URL} · reports ANPR events and gate decisions only.
                </p>
              </div>
            </div>
            <StatusBadge status={online ? 'ACTIVE' : 'SUSPENDED'} />
          </div>
          <p className="mt-4 text-xs text-[#605e5c]">
            Nest receives metadata and decisions only. Use the NVR / MinIO
            archive for live and recorded video.
          </p>
        </GlassCard>
      </div>

      <div className="mt-8">
        <SectionTitle>ANPR events</SectionTitle>
        <DataTable<AnprResult>
          loading={loading}
          keyField="id"
          rows={rows}
          emptyMessage="No ANPR results — ingest via parking / vision-ai."
          columns={[
            { key: 'plateNumber', label: 'Plate' },
            {
              key: 'confidence',
              label: 'Confidence',
              render: (r) =>
                r.confidence != null
                  ? `${Math.round(r.confidence * 100)}%`
                  : '—',
            },
            {
              key: 'decision',
              label: 'Decision',
              render: (r) =>
                r.decision ? <StatusBadge status={r.decision} /> : '—',
            },
            {
              key: 'capturedAt',
              label: 'Captured',
              render: (r) => new Date(r.capturedAt).toLocaleString(),
            },
          ]}
        />
      </div>
    </div>
  );
}
