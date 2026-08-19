'use client';

import {
  createMySupplierMessage,
  getSupplierMe,
  listMySupplierMessages,
  type SupplierPortalMessage,
  type SupplierProfile,
} from '@pssms/api-client';
import { RefreshCw, Send } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  PortalError,
  PortalHero,
  PortalPanel,
  formatDate,
} from '../../_components/portal-ui';

export default function MessagesPage() {
  const [me, setMe] = useState<SupplierProfile | null>(null);
  const [rows, setRows] = useState<SupplierPortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, list] = await Promise.all([
        getSupplierMe(),
        listMySupplierMessages(),
      ]);
      setMe(profile);
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      setError('Write a message first');
      return;
    }
    if (me?.status === 'REJECTED' || me?.status === 'SUSPENDED') {
      setError('Suspended or rejected suppliers cannot message procurement');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await createMySupplierMessage(text);
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PortalHero
        eyebrow="Portal 35.17"
        title="Procurement"
        subtitle="Message HIGHLINK procurement about quotes, POs, invoices, delivery notes, and payment. This is not a public helpdesk."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <PortalPanel title="Thread">
        {loading ? (
          <p className="text-sm text-[#605e5c]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#605e5c]">
            No messages yet. Ask procurement about an issued purchase order or
            a submitted invoice.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((m) => {
              const mine = m.authorType === 'SUPPLIER';
              return (
                <li
                  key={m.id}
                  className={`rounded-xl px-3 py-2.5 ${
                    mine
                      ? 'ml-8 bg-amber-50 text-[#9a3412]'
                      : 'mr-8 bg-[#eff6fc] text-[#1b1a19]'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                    {mine ? 'You' : m.authorName ?? 'Procurement'} ·{' '}
                    {formatDate(m.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={(e) => void onSend(e)} className="mt-4 flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Write to procurement…"
            className="min-h-[4.5rem] flex-1 rounded-lg border border-[#c8c6c4] bg-white px-3 py-2 text-sm outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20"
          />
          <button
            type="submit"
            disabled={
              sending ||
              me?.status === 'REJECTED' ||
              me?.status === 'SUSPENDED'
            }
            className="inline-flex h-10 shrink-0 items-center gap-1.5 self-end rounded-lg bg-[#ea580c] px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </PortalPanel>
    </>
  );
}
