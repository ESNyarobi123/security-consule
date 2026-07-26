'use client';

import { btnSecondary } from '@pssms/ui';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function ApiKeyReveal({
  label,
  apiKey,
}: {
  label: string;
  apiKey: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 ring-1 ring-amber-400/20">
      <p className="text-xs font-semibold text-amber-100">
        {label} — copy now, it is shown only once
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 break-all rounded-md bg-black/30 px-2 py-1.5 font-mono text-xs text-slate-100">
          {apiKey}
        </code>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            void navigator.clipboard?.writeText(apiKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
