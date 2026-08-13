'use client';

import {
  approveParkingViolationClosure,
  billParkingViolation,
  submitParkingViolationClosure,
  updateParkingViolation,
  getDocumentDownloadUrl,
  listDocuments,
  uploadDocument,
  type DocumentObject,
  type ParkingOpsViolation,
} from '@pssms/api-client';
import { Camera, CheckCircle2, Receipt, Send, X } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

const fieldCls =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20';

type Props = {
  violation: ParkingOpsViolation;
  onClose: () => void;
  onUpdated: (v: ParkingOpsViolation) => void;
};

function isClosed(status: string): boolean {
  return status === 'CLOSED' || status === 'RESOLVED';
}

function money(n: number, currency = 'TZS'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function ViolationManageModal({
  violation,
  onClose,
  onUpdated,
}: Props) {
  const [row, setRow] = useState(violation);
  const [docs, setDocs] = useState<DocumentObject[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [officerRemarks, setOfficerRemarks] = useState(
    violation.officerRemarks ?? '',
  );
  const [correctiveAction, setCorrectiveAction] = useState(
    violation.correctiveAction ?? '',
  );
  const [fineAmount, setFineAmount] = useState(
    violation.fineAmount != null ? String(violation.fineAmount) : '',
  );
  const [discountAmount, setDiscountAmount] = useState(
    violation.discountAmount != null ? String(violation.discountAmount) : '',
  );
  const [approvalNotes, setApprovalNotes] = useState('');
  const [closureNotes, setClosureNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const list = await listDocuments({
        resourceType: 'ParkingViolation',
        resourceId: row.id,
      });
      setDocs(list);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }, [row.id]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  async function onUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      await uploadDocument({
        file,
        resourceType: 'ParkingViolation',
        resourceId: row.id,
      });
      await loadDocs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveCorrective(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fine = fineAmount.trim() ? Number(fineAmount) : null;
      const discount = discountAmount.trim() ? Number(discountAmount) : null;
      if (fine != null && (Number.isNaN(fine) || fine < 0)) {
        throw new Error('Fine must be a non-negative number');
      }
      if (discount != null && (Number.isNaN(discount) || discount < 0)) {
        throw new Error('Discount must be a non-negative number');
      }
      const updated = await updateParkingViolation(row.id, {
        officerRemarks: officerRemarks.trim() || undefined,
        correctiveAction: correctiveAction.trim(),
        ...(row.invoiceId
          ? {}
          : {
              fineAmount: fine,
              discountAmount: discount,
              currency: fine != null ? 'TZS' : undefined,
            }),
      });
      setRow(updated);
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onBill(send = false) {
    setBusy(true);
    setError(null);
    try {
      const updated = await billParkingViolation(row.id, { send });
      setRow(updated);
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bill failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitClosure() {
    setBusy(true);
    setError(null);
    try {
      const updated = await submitParkingViolationClosure(row.id);
      setRow(updated);
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  async function onApprove(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await approveParkingViolationClosure(row.id, {
        approvalNotes: approvalNotes.trim() || undefined,
        closureNotes: closureNotes.trim() || undefined,
      });
      setRow(updated);
      onUpdated(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  }

  const canEdit =
    !isClosed(row.status) &&
    (row.status === 'OPEN' || row.status === 'CORRECTIVE_ACTION');
  const canSubmit =
    !isClosed(row.status) &&
    row.status !== 'PENDING_CLOSURE' &&
    !!row.correctiveAction?.trim();
  const canApprove = row.status === 'PENDING_CLOSURE';
  const canBill =
    !row.invoiceId &&
    row.netFineAmount != null &&
    row.netFineAmount > 0 &&
    !!row.vehicleId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Manage violation
            </h2>
            <p className="text-sm text-slate-600">
              {row.plateNumber} · {row.violationType.replace(/_/g, ' ')} ·{' '}
              <span className="font-semibold">{row.status}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <section className="mb-4 rounded-lg border border-slate-200 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Camera className="h-4 w-4" />
            Photographs
          </h3>
          {docsLoading ? (
            <p className="mt-2 text-xs text-slate-500">Loading…</p>
          ) : docs.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No photos yet</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between">
                  <span className="truncate">{d.fileName}</span>
                  <button
                    type="button"
                    className="text-teal-700 hover:underline"
                    onClick={() =>
                      void getDocumentDownloadUrl(d.id).then((r) => {
                        window.open(r.url, '_blank', 'noopener,noreferrer');
                      })
                    }
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isClosed(row.status) ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="mt-2 text-xs font-semibold text-teal-700 hover:underline disabled:opacity-50"
              >
                Upload photo
              </button>
            </>
          ) : null}
        </section>

        {canEdit ? (
          <form onSubmit={(ev) => void onSaveCorrective(ev)} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Officer remarks
              </span>
              <textarea
                value={officerRemarks}
                onChange={(e) => setOfficerRemarks(e.target.value)}
                rows={2}
                className={`${fieldCls} resize-y`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Corrective action *
              </span>
              <textarea
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                rows={3}
                placeholder="Tow, warning, relocation…"
                className={`${fieldCls} resize-y`}
                required
                minLength={3}
              />
            </label>
            {!row.invoiceId ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Fine (TZS)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="1000"
                    value={fineAmount}
                    onChange={(e) => setFineAmount(e.target.value)}
                    className={fieldCls}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Discount
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="1000"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className={fieldCls}
                  />
                </label>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Save action
            </button>
          </form>
        ) : (
          <div className="space-y-2 text-sm text-slate-700">
            {row.officerRemarks ? (
              <p>
                <span className="font-semibold">Officer:</span>{' '}
                {row.officerRemarks}
              </p>
            ) : null}
            {row.correctiveAction ? (
              <p>
                <span className="font-semibold">Corrective:</span>{' '}
                {row.correctiveAction}
              </p>
            ) : null}
          </div>
        )}

        <section className="mt-4 rounded-lg border border-slate-200 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Receipt className="h-4 w-4" />
            Fine / invoice
          </h3>
          {row.netFineAmount != null && row.netFineAmount > 0 ? (
            <p className="mt-2 text-sm text-slate-700">
              Net{' '}
              <span className="font-semibold">
                {money(row.netFineAmount, row.currency || 'TZS')}
              </span>
              {row.invoiceNumber ? (
                <span className="ml-2 text-xs text-teal-800">
                  {row.invoiceNumber} · {row.invoiceStatus}
                  {row.balanceDue != null && row.balanceDue > 0
                    ? ` · balance ${row.balanceDue}`
                    : ''}
                </span>
              ) : (
                <span className="ml-2 text-xs font-semibold uppercase text-amber-700">
                  Unbilled
                </span>
              )}
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              No fine set — add amount above before billing.
            </p>
          )}
          {canBill ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onBill(false)}
                className="rounded-md border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900 hover:bg-teal-100 disabled:opacity-60"
              >
                Bill draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onBill(true)}
                className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
              >
                Send invoice
              </button>
            </div>
          ) : null}
        </section>

        {canSubmit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSubmitClosure()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            Submit for closure approval
          </button>
        ) : null}

        {canApprove ? (
          <form onSubmit={(ev) => void onApprove(ev)} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              Submitter and recorder cannot approve (SoD).
            </p>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Approval notes
              </span>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={2}
                className={`${fieldCls} resize-y`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Closure record
              </span>
              <textarea
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                rows={2}
                className={`${fieldCls} resize-y`}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve &amp; close
            </button>
          </form>
        ) : null}

        {isClosed(row.status) && (row.closureNotes || row.approvalNotes) ? (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            {row.approvalNotes ? (
              <p>
                <span className="font-semibold">Approval:</span>{' '}
                {row.approvalNotes}
              </p>
            ) : null}
            {row.closureNotes ? (
              <p className="mt-1">
                <span className="font-semibold">Closure:</span>{' '}
                {row.closureNotes}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
