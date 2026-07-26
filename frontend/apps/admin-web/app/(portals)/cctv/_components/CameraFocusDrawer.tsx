'use client';

import type { Device } from '@pssms/api-client';
import { ExternalLink, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { CameraTile } from './CameraTile';
import {
  WALL,
  cameraEmbedUrl,
  cameraSnapshotUrl,
  cameraZone,
  isDeviceOnline,
  relativeTime,
  safeHttpUrl,
} from './shared';

export function CameraFocusDrawer({
  device,
  siteLabel,
  onClose,
}: {
  device: Device;
  siteLabel?: string;
  onClose: () => void;
}) {
  const online = isDeviceOnline(device.status);
  const embed = cameraEmbedUrl(device);
  const snapshot = cameraSnapshotUrl(device);
  const zone = cameraZone(device);
  const nvrLink =
    embed ??
    safeHttpUrl(
      typeof device.config?.streamUrl === 'string'
        ? device.config.streamUrl
        : undefined,
    );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[55] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`${device.name} detail`}
    >
      <button
        type="button"
        aria-label="Close camera detail"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      />
      <aside
        className="cctv-drawer relative z-10 flex h-full w-full max-w-md flex-col shadow-2xl"
        style={{
          background: WALL.panel,
          borderLeft: `1px solid ${WALL.borderStrong}`,
        }}
      >
        <header
          className="flex items-start justify-between gap-3 px-5 py-4"
          style={{ borderBottom: `1px solid ${WALL.border}` }}
        >
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: WALL.muted }}
            >
              Camera focus
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold text-white">
              {device.name}
            </h2>
            <p className="font-mono text-xs" style={{ color: WALL.muted }}>
              {device.code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 overflow-hidden rounded-md">
            <CameraTile device={device} siteLabel={siteLabel} preview />
          </div>

          <dl className="space-y-3 text-sm">
            <Row label="Status">
              <span style={{ color: online ? WALL.online : WALL.offline }}>
                {device.status}
                {online ? ' · pulse live' : ''}
              </span>
            </Row>
            <Row label="Vendor">{device.vendor ?? '—'}</Row>
            <Row label="Connection">{device.connection}</Row>
            <Row label="Site">{siteLabel ?? '—'}</Row>
            <Row label="NVR channel">{zone ?? '—'}</Row>
            <Row label="Last seen">{relativeTime(device.lastSeenAt)}</Row>
            <Row label="Stream / embed">
              <span
                className="break-all font-mono text-[11px]"
                style={{ color: WALL.muted }}
              >
                {embed ??
                  (typeof device.config?.streamUrl === 'string'
                    ? device.config.streamUrl
                    : '—')}
              </span>
            </Row>
            {snapshot ? (
              <Row label="Snapshot">
                <span
                  className="break-all font-mono text-[11px]"
                  style={{ color: WALL.muted }}
                >
                  {snapshot}
                </span>
              </Row>
            ) : null}
          </dl>

          <p
            className="mt-5 text-[11px] leading-relaxed"
            style={{ color: WALL.muted }}
          >
            Nest does not proxy live video. Open the NVR link in a new tab when
            an embed or stream URL is configured.
          </p>
        </div>

        <footer
          className="px-5 py-4"
          style={{ borderTop: `1px solid ${WALL.border}` }}
        >
          {nvrLink ? (
            <a
              href={nvrLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: WALL.accent }}
            >
              <ExternalLink className="h-4 w-4" />
              Open NVR link
            </a>
          ) : (
            <p
              className="rounded-md px-3 py-2 text-center text-xs"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                color: WALL.amber,
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              No http(s) stream/embed URL on this camera yet.
            </p>
          )}
        </footer>
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className="flex items-start justify-between gap-4 border-b pb-2"
      style={{ borderColor: WALL.border }}
    >
      <dt className="shrink-0 text-xs" style={{ color: WALL.muted }}>
        {label}
      </dt>
      <dd className="text-right text-sm text-white">{children}</dd>
    </div>
  );
}
