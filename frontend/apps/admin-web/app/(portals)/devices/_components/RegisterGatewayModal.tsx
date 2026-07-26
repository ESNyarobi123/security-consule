'use client';

import { registerGateway, type Site } from '@pssms/api-client';
import { Modal, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import { FormEvent, useState } from 'react';

export function RegisterGatewayModal({
  sites,
  onClose,
  onCreated,
}: {
  sites: Site[];
  onClose: () => void;
  onCreated: (apiKey?: string) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const gw = await registerGateway({
        code,
        name,
        siteId: siteId.trim() || undefined,
      });
      onCreated(gw.apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New edge gateway"
      description="Site hub that forwards USB / edge device traffic to PSSMS."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-[#323130]">
          Code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputCls}
            placeholder="GW-HQ-01"
            required
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="HQ Gate Edge Gateway"
            required
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Site <span className="font-normal text-[#605e5c]">(optional)</span>
          {sites.length > 0 ? (
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className={inputCls}
            >
              <option value="">— none —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className={inputCls}
              placeholder="site UUID"
            />
          )}
        </label>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Registering…' : 'Register gateway'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
