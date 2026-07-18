import { Injectable, Logger } from '@nestjs/common';

interface PendingCommand {
  id: string;
  deviceId: string;
  type: string;
  payload?: Record<string, unknown> | null;
}

/**
 * ZKTeco iClock / ADMS push-protocol adapter.
 *
 * Translates the raw plain-text device protocol into calls against the core-api
 * device-integration internal API (resolving devices by serial number). Devices
 * push outbound over HTTP(S) — no static IP / VPN required.
 */
@Injectable()
export class IclockService {
  private readonly logger = new Logger(IclockService.name);
  private readonly base =
    process.env.CORE_API_INTERNAL_URL ?? 'http://core-api:4001';
  private readonly token =
    process.env.INTEGRATION_SERVICE_TOKEN ?? 'dev_integration_token';

  /** Handshake config returned when a device sends `?options=all`. */
  buildOptions(sn: string): string {
    return [
      `GET OPTION FROM: ${sn}`,
      'ATTLOGStamp=0',
      'OPERLOGStamp=0',
      'ATTPHOTOStamp=0',
      'ErrorDelay=10',
      'Delay=5',
      'TransTimes=00:00;23:59',
      'TransInterval=1',
      'TransFlag=111111111111',
      'Realtime=1',
      'ServerVer=3.0.1',
      'PushProtVer=2.4.1',
      'TimeZone=3',
      '',
    ].join('\n');
  }

  /** Parse ATTLOG body → normalized events → forward to core-api. */
  async ingestAttlog(sn: string, rawBody: string): Promise<string> {
    const lines = (rawBody ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const events = lines.map((line) => {
      const cols = line.split('\t');
      const pin = cols[0] ?? '';
      const time = cols[1] ?? '';
      const status = cols[2] ?? '';
      const verify = cols[3] ?? '';
      const capturedAt = time
        ? new Date(time.replace(' ', 'T'))
        : new Date();
      return {
        type: 'ATTENDANCE_PUNCH',
        capturedAt: (isNaN(capturedAt.getTime()) ? new Date() : capturedAt).toISOString(),
        dedupeKey: `${sn}:${pin}:${time}:${status}`,
        payload: { pin, time, status, verify, raw: line, source: 'iclock' },
      };
    });

    if (events.length === 0) return 'OK';

    try {
      const res = await this.post('/api/v1/internal/v1/devices/ingest', {
        serialNumber: sn,
        events,
      });
      this.logger.log(
        `ATTLOG ${sn}: ${events.length} rows → ${JSON.stringify(res)}`,
      );
      return `OK: ${events.length}`;
    } catch (err) {
      this.logger.error(`ATTLOG ingest failed for ${sn}: ${(err as Error).message}`);
      // Return OK anyway so the device does not wedge; core-api retry/backfill
      // is handled out of band. (Devices re-push on non-OK inconsistently.)
      return 'OK';
    }
  }

  /** Device heartbeat/poll → refresh liveness + return queued commands. */
  async getRequest(sn: string): Promise<string> {
    try {
      await this.post('/api/v1/internal/v1/devices/heartbeat', {
        serialNumber: sn,
      });
    } catch (err) {
      this.logger.warn(`heartbeat failed for ${sn}: ${(err as Error).message}`);
    }

    try {
      const data = await this.get(
        `/api/v1/internal/v1/devices/commands?serialNumber=${encodeURIComponent(sn)}`,
      );
      const commands: PendingCommand[] =
        (data?.data?.commands ?? data?.commands ?? []) as PendingCommand[];
      if (!commands.length) return 'OK';
      return commands.map((c) => this.toIclockCommand(c)).join('\n');
    } catch (err) {
      this.logger.warn(`poll failed for ${sn}: ${(err as Error).message}`);
      return 'OK';
    }
  }

  /** Device reports a command result (`ID=..&Return=..&CMD=..`). */
  async deviceCmdResult(sn: string, rawBody: unknown): Promise<string> {
    const fields =
      typeof rawBody === 'string'
        ? this.parseFormBody(rawBody)
        : this.coerceFields(rawBody as Record<string, unknown>);
    const id = fields.ID;
    const ret = fields.Return;
    if (!id) return 'OK';
    const status = ret === '0' ? 'ACKED' : 'FAILED';
    try {
      await this.post(
        `/api/v1/internal/v1/devices/commands/${encodeURIComponent(id)}/ack`,
        { serialNumber: sn, status, result: fields },
      );
    } catch (err) {
      this.logger.warn(`ack failed for ${sn}/${id}: ${(err as Error).message}`);
    }
    return 'OK';
  }

  private toIclockCommand(c: PendingCommand): string {
    const p = (c.payload ?? {}) as Record<string, unknown>;
    const pin = p.pin ?? p.employeeId ?? '';
    switch (c.type) {
      case 'ENROLL_FINGERPRINT':
        return `C:${c.id}:ENROLL_FP PIN=${pin} FID=${p.fid ?? 0} RETRY=3 OVERWRITE=1`;
      case 'ENROLL_FACE':
        return `C:${c.id}:ENROLL_BIO TYPE=9 PIN=${pin} RETRY=3 OVERWRITE=1`;
      case 'ENROLL_CARD':
        return `C:${c.id}:ENROLL_MIFARE PIN=${pin}`;
      case 'DELETE_USER':
        return `C:${c.id}:DATA DELETE USERINFO PIN=${pin}`;
      case 'SYNC_USERS':
        return `C:${c.id}:DATA QUERY USERINFO`;
      case 'OPEN_GATE':
        return `C:${c.id}:AC_UNLOCK`;
      case 'REBOOT':
        return `C:${c.id}:REBOOT`;
      default:
        return `C:${c.id}:CHECK`;
    }
  }

  private coerceFields(obj: Record<string, unknown> | null): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
      out[k] = v == null ? '' : String(v);
    }
    return out;
  }

  private parseFormBody(raw: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const pair of (raw ?? '').split(/[&\n]/)) {
      const idx = pair.indexOf('=');
      if (idx > 0) {
        out[pair.slice(0, idx).trim()] = decodeURIComponent(
          pair.slice(idx + 1).trim(),
        );
      }
    }
    return out;
  }

  private async post(path: string, body: unknown): Promise<any> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`core-api ${path} → ${res.status}`);
    return res.json().catch(() => null);
  }

  private async get(path: string): Promise<any> {
    const res = await fetch(`${this.base}${path}`, {
      headers: { authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`core-api ${path} → ${res.status}`);
    return res.json().catch(() => null);
  }
}
