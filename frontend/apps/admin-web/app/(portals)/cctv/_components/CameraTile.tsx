'use client';

import type { Device } from '@pssms/api-client';
import { Video } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  WALL,
  cameraEmbedUrl,
  cameraSnapshotUrl,
  cameraZone,
  isDeviceOnline,
} from './shared';

function TileVisual({
  device,
  siteLabel,
}: {
  device: Device;
  siteLabel?: string;
}) {
  const online = isDeviceOnline(device.status);
  const embed = cameraEmbedUrl(device);
  const snapshot = cameraSnapshotUrl(device);
  const zone = cameraZone(device);

  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

      {embed ? (
        <iframe
          title={device.name}
          src={embed}
          className="absolute inset-0 h-full w-full border-0 bg-black"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      ) : snapshot ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={snapshot}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-500 group-hover:opacity-100"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'rgba(18, 38, 63, 0.9)',
              border: `1px solid ${WALL.borderStrong}`,
            }}
          >
            <Video className="h-6 w-6" style={{ color: WALL.muted }} />
            {online ? (
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-30"
                style={{ border: `2px solid ${WALL.online}` }}
              />
            ) : null}
          </div>
          <p
            className="font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: WALL.muted }}
          >
            {zone ? `NVR · ${zone}` : 'Awaiting NVR embed'}
          </p>
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.35) 2px, rgba(0,0,0,0.35) 3px)',
        }}
      />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-2.5 pb-6 pt-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-white">
            {device.name}
          </p>
          <p
            className="truncate font-mono text-[9px] uppercase tracking-wider"
            style={{ color: WALL.muted }}
          >
            {device.code}
            {siteLabel ? ` · ${siteLabel}` : ''}
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{
            background: online
              ? 'rgba(52, 211, 153, 0.15)'
              : 'rgba(248, 113, 113, 0.15)',
            color: online ? WALL.online : WALL.offline,
            border: `1px solid ${
              online
                ? 'rgba(52, 211, 153, 0.35)'
                : 'rgba(248, 113, 113, 0.35)'
            }`,
          }}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${online ? 'animate-pulse' : ''}`}
            style={{ background: online ? WALL.online : WALL.offline }}
          />
          {online ? 'Live' : device.status}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6">
        <span
          className="font-mono text-[9px] uppercase tracking-wider"
          style={{ color: WALL.muted }}
        >
          {device.vendor ?? 'Camera'} · {device.connection}
        </span>
        {zone ? (
          <span
            className="rounded px-1 font-mono text-[9px]"
            style={{
              color: WALL.amber,
              background: 'rgba(245, 158, 11, 0.12)',
            }}
          >
            CH {zone}
          </span>
        ) : null}
      </div>
    </>
  );
}

const shellCls =
  'group relative aspect-video w-full overflow-hidden rounded-md text-left outline-none transition duration-300';

function Shell({
  interactive,
  onSelect,
  children,
}: {
  interactive: boolean;
  onSelect?: () => void;
  children: ReactNode;
}) {
  const style = {
    background: WALL.bgSoft,
    border: `1px solid ${WALL.border}`,
  } as const;

  if (interactive && onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`${shellCls} hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#0078d4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628]`}
        style={style}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={shellCls} style={style}>
      {children}
    </div>
  );
}

export function CameraTile({
  device,
  siteLabel,
  onSelect,
  preview = false,
}: {
  device: Device;
  siteLabel?: string;
  onSelect?: (d: Device) => void;
  preview?: boolean;
}) {
  return (
    <Shell
      interactive={!preview && !!onSelect}
      onSelect={onSelect ? () => onSelect(device) : undefined}
    >
      <TileVisual device={device} siteLabel={siteLabel} />
    </Shell>
  );
}

export function EmptyMonitorSlot({ index }: { index: number }) {
  return (
    <div
      className="relative aspect-video overflow-hidden rounded-md"
      style={{
        background: 'rgba(10, 22, 40, 0.6)',
        border: `1px dashed ${WALL.border}`,
      }}
      aria-hidden
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.25em]"
          style={{ color: 'rgba(148, 163, 184, 0.35)' }}
        >
          Slot {String(index + 1).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
