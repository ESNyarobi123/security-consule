'use client';

import {
  disableMfa,
  enableMfa,
  getMfaStatus,
  setupMfa,
  type MfaSetup,
} from '@pssms/api-client';
import { GlassCard, btnPrimary, btnSecondary } from '@pssms/ui';
import { KeyRound, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { EssShell } from '../_components/EssShell';

function formatApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {
      message?: string | string[];
      error?: { message?: string; code?: string };
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    /* plain text */
  }
  return raw;
}

export default function EssSecurityPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [enableCode, setEnableCode] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await getMfaStatus();
      setEnabled(status.mfaEnabled);
      if (status.mfaEnabled) setSetup(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onBeginSetup() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await setupMfa();
      setSetup(result);
      setEnableCode('');
      setInfo('Add the key in your authenticator app, then confirm with a code.');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onEnable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await enableMfa(enableCode.trim());
      setSetup(null);
      setEnableCode('');
      setEnabled(true);
      setInfo('MFA is now required at sign-in.');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDisable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await disableMfa(disableCode.trim());
      setDisableCode('');
      setEnabled(false);
      setSetup(null);
      setInfo('MFA disabled for this account.');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <EssShell
      title="Security"
      description="Authenticator MFA for your account (Module 5). Self-service only."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || busy}
          className={btnSecondary}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {info}
        </p>
      ) : null}

      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            {enabled ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldOff className="mt-0.5 h-5 w-5 text-slate-400" />
            )}
            <div>
              <p className="text-base font-semibold text-[#1b1a19]">
                Multi-factor authentication
              </p>
              <p className="mt-0.5 text-xs text-[#605e5c]">
                {loading
                  ? 'Checking status…'
                  : enabled
                    ? 'Enabled — a TOTP code is required after password at login.'
                    : 'Not enabled — use an authenticator app (Google / Microsoft / Authy).'}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              enabled
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {enabled ? 'On' : 'Off'}
          </span>
        </div>

        {!enabled && !setup ? (
          <div className="mt-4">
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void onBeginSetup()}
              className={btnPrimary}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Set up authenticator
            </button>
          </div>
        ) : null}

        {setup ? (
          <div className="mt-4 space-y-3 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-4">
            <p className="text-xs text-[#605e5c]">
              In your authenticator app choose <strong>Enter a setup key</strong>{' '}
              (or open the otpauth link on a phone), then enter the current
              6-digit code below.
            </p>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                Setup key
              </p>
              <p className="mt-1 break-all rounded-md border border-[#e1dfdd] bg-white px-3 py-2 font-mono text-sm tracking-wider text-[#1b1a19]">
                {setup.secret}
              </p>
            </div>
            <a
              href={setup.otpauthUri}
              className="inline-block text-xs font-medium text-[#0078d4] hover:underline"
            >
              Open otpauth:// provisioning link
            </a>
            <form onSubmit={onEnable} className="flex flex-wrap items-end gap-2">
              <label className="block min-w-[160px] flex-1">
                <span className="text-[11px] font-semibold text-[#323130]">
                  Confirmation code
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6,8}"
                  maxLength={8}
                  value={enableCode}
                  onChange={(e) =>
                    setEnableCode(e.target.value.replace(/\s+/g, ''))
                  }
                  className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm tracking-[0.25em]"
                  placeholder="123456"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={busy || enableCode.length < 6}
                className={btnPrimary}
              >
                Enable MFA
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSetup(null);
                  setEnableCode('');
                }}
                className={btnSecondary}
              >
                Cancel
              </button>
            </form>
          </div>
        ) : null}

        {enabled ? (
          <form
            onSubmit={onDisable}
            className="mt-4 flex flex-wrap items-end gap-2 border-t border-[#e1dfdd] pt-4"
          >
            <label className="block min-w-[160px] flex-1">
              <span className="text-[11px] font-semibold text-[#323130]">
                Code to disable MFA
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                maxLength={8}
                value={disableCode}
                onChange={(e) =>
                  setDisableCode(e.target.value.replace(/\s+/g, ''))
                }
                className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm tracking-[0.25em]"
                placeholder="123456"
                required
              />
            </label>
            <button
              type="submit"
              disabled={busy || disableCode.length < 6}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              Disable MFA
            </button>
          </form>
        ) : null}
      </GlassCard>

      <p className="mt-4 text-[11px] text-[#a19f9d]">
        Deferred: org-wide MFA force policy, recovery codes, admin reset of
        another user&apos;s MFA, QR canvas renderer.
      </p>
    </EssShell>
  );
}
