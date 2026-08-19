'use client';

import {
  addPurchaseRequestQuote,
  approvePurchaseOrder,
  approvePurchaseRequest,
  approveSupplier,
  approveSupplierSubmission,
  awardPurchaseRequestQuote,
  convertPurchaseRequest,
  createPurchaseOrder,
  createPurchaseRequest,
  createSupplier,
  createSupplierMessage,
  getDocumentDownloadUrl,
  listDocuments,
  listPurchaseOrders,
  listPurchaseRequests,
  listSupplierSubmissions,
  listSuppliers,
  listSupplierMessages,
  markSupplierSubmissionPaid,
  rejectPurchaseRequest,
  rejectSupplier,
  rejectSupplierSubmission,
  submitPurchaseOrder,
  submitPurchaseRequest,
  suspendSupplier,
  uploadDocument,
  type DocumentObject,
  type PurchaseOrder,
  type PurchaseRequest,
  type Supplier,
  type SupplierMessage,
  type SupplierSubmission,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import {
  btnPrimary,
  btnSecondary,
  inputCls,
  Modal,
  PageHeader,
  StatCard,
} from '@pssms/ui';
import {
  BadgeCheck,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ProcurementEmpty,
  PurchaseOrderRoster,
  SubmissionRoster,
  SupplierRoster,
} from '../_components/ProcurementRosters';

type SupplierFilter = 'all' | 'pending' | 'approved' | 'rejected';
type PoFilter = 'all' | 'draft' | 'pending' | 'approved';

const SUPPLIER_FILTERS: { id: SupplierFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const PO_FILTERS: { id: PoFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
];

function norm(s: string) {
  return s.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

const money = (n: number, currency = 'TZS') =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

type SupplierForm = {
  code: string;
  name: string;
  email: string;
  phone: string;
  tin: string;
  vrn: string;
  category: string;
  address: string;
  contactPerson: string;
};
type LineDraft = { description: string; quantity: string; unitPrice: string };
type PoForm = { supplierId: string; poNumber: string; lines: LineDraft[] };

const emptySupplier: SupplierForm = {
  code: '',
  name: '',
  email: '',
  phone: '',
  tin: '',
  vrn: '',
  category: 'GOODS',
  address: '',
  contactPerson: '',
};
const emptyLine: LineDraft = { description: '', quantity: '1', unitPrice: '0' };
const emptyPo = (supplierId: string): PoForm => ({
  supplierId,
  poNumber: `PO-${Date.now().toString().slice(-5)}`,
  lines: [{ ...emptyLine }],
});

export default function ProcurementPage() {
  const sessionUser = useMemo(() => getSessionUser(), []);
  const isSuperAdmin = sessionUser?.roles?.includes('SUPER_ADMIN') ?? false;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [submissions, setSubmissions] = useState<SupplierSubmission[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplier);
  const [poForm, setPoForm] = useState<PoForm>(emptyPo(''));
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [savingPo, setSavingPo] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierFilter, setSupplierFilter] =
    useState<SupplierFilter>('all');
  const [poQuery, setPoQuery] = useState('');
  const [poFilter, setPoFilter] = useState<PoFilter>('all');
  const [rejectTarget, setRejectTarget] = useState<Supplier | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [subRejectTarget, setSubRejectTarget] =
    useState<SupplierSubmission | null>(null);
  const [docsTarget, setDocsTarget] = useState<Supplier | null>(null);
  const [docs, setDocs] = useState<DocumentObject[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [msgTarget, setMsgTarget] = useState<Supplier | null>(null);
  const [messages, setMessages] = useState<SupplierMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgBody, setMsgBody] = useState('');
  const [prOpen, setPrOpen] = useState(false);
  const [prForm, setPrForm] = useState({
    department: 'Operations',
    purpose: '',
    description: '',
    quantity: '1',
  });
  const [comparePr, setComparePr] = useState<PurchaseRequest | null>(null);
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [quotePrices, setQuotePrices] = useState<Record<string, string>>({});
  const [prReject, setPrReject] = useState<PurchaseRequest | null>(null);
  const [prRejectReason, setPrRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, sub, prs] = await Promise.all([
        listSuppliers(),
        listPurchaseOrders(),
        listSupplierSubmissions(),
        listPurchaseRequests(),
      ]);
      setSuppliers(s);
      setPos(p);
      setSubmissions(sub);
      setRequests(prs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const approved = suppliers.filter(
      (s) => norm(s.status) === 'approved' || norm(s.status) === 'active',
    ).length;
    const totalValue = pos.reduce(
      (sum, p) => sum + (Number.isFinite(p.totalAmount) ? p.totalAmount : 0),
      0,
    );
    const pending = pos.filter(
      (p) =>
        norm(p.status) === 'pending_approval' ||
        norm(p.status) === 'submitted',
    ).length;
    const drafts = pos.filter((p) => norm(p.status) === 'draft').length;
    return { approved, totalValue, pending, drafts };
  }, [suppliers, pos]);

  const supplierCounts = useMemo(() => {
    const c = { all: suppliers.length, pending: 0, approved: 0, rejected: 0 };
    for (const s of suppliers) {
      const st = norm(s.status);
      if (st === 'approved' || st === 'active') c.approved += 1;
      else if (st === 'rejected') c.rejected += 1;
      else c.pending += 1;
    }
    return c;
  }, [suppliers]);

  const poCounts = useMemo(() => {
    const c = { all: pos.length, draft: 0, pending: 0, approved: 0 };
    for (const p of pos) {
      const st = norm(p.status);
      if (st === 'draft') c.draft += 1;
      else if (st === 'pending_approval' || st === 'submitted') c.pending += 1;
      else if (st === 'approved') c.approved += 1;
    }
    return c;
  }, [pos]);

  const supplierNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of suppliers) map.set(s.id, s.name);
    return map;
  }, [suppliers]);

  const approvedSuppliers = useMemo(
    () =>
      suppliers.filter((s) => {
        const st = norm(s.status);
        return st === 'approved' || st === 'active';
      }),
    [suppliers],
  );

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    return suppliers.filter((s) => {
      const st = norm(s.status);
      const isApproved = st === 'approved' || st === 'active';
      const isRejected = st === 'rejected';
      if (supplierFilter === 'approved' && !isApproved) return false;
      if (supplierFilter === 'pending' && (isApproved || isRejected))
        return false;
      if (supplierFilter === 'rejected' && !isRejected) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q) ||
        (s.phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [suppliers, supplierQuery, supplierFilter]);

  const filteredPos = useMemo(() => {
    const q = poQuery.trim().toLowerCase();
    return pos.filter((p) => {
      const st = norm(p.status);
      if (poFilter === 'draft' && st !== 'draft') return false;
      if (
        poFilter === 'pending' &&
        st !== 'pending_approval' &&
        st !== 'submitted'
      )
        return false;
      if (poFilter === 'approved' && st !== 'approved') return false;
      if (!q) return true;
      const name = (supplierNameMap.get(p.supplierId) ?? '').toLowerCase();
      return (
        p.poNumber.toLowerCase().includes(q) ||
        name.includes(q) ||
        p.status.toLowerCase().includes(q)
      );
    });
  }, [pos, poQuery, poFilter, supplierNameMap]);

  function openSupplierModal() {
    setSupplierForm(emptySupplier);
    setSupplierOpen(true);
  }

  function openPoModal() {
    const approved = suppliers.find((s) => s.status === 'APPROVED');
    const initial = approved ?? suppliers[0];
    setPoForm(emptyPo(initial?.id ?? ''));
    setPoOpen(true);
  }

  const poTotalPreview = useMemo(
    () =>
      poForm.lines.reduce(
        (sum, l) =>
          sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
        0,
      ),
    [poForm.lines],
  );

  async function submitSupplier() {
    if (!supplierForm.code.trim() || !supplierForm.name.trim()) {
      setError('Supplier code and name are required');
      return;
    }
    setSavingSupplier(true);
    setError(null);
    try {
      await createSupplier({
        code: supplierForm.code.trim(),
        name: supplierForm.name.trim(),
        email: supplierForm.email.trim() || undefined,
        phone: supplierForm.phone.trim() || undefined,
        tin: supplierForm.tin.trim() || undefined,
        vrn: supplierForm.vrn.trim() || undefined,
        address: supplierForm.address.trim() || undefined,
        category: supplierForm.category,
        contactPerson: supplierForm.contactPerson.trim() || undefined,
      });
      setSupplierOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create supplier');
    } finally {
      setSavingSupplier(false);
    }
  }

  async function submitPo() {
    const supplier = suppliers.find((s) => s.id === poForm.supplierId);
    if (!supplier) {
      setError('Select a supplier for the purchase order');
      return;
    }
    const lines = poForm.lines
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      }))
      .filter(
        (l) => l.description && l.quantity > 0 && Number.isFinite(l.unitPrice),
      );
    if (lines.length === 0) {
      setError('Add at least one line with a description and quantity');
      return;
    }
    setSavingPo(true);
    setError(null);
    try {
      // A PO can only be raised against an approved supplier — approve inline if needed.
      if (supplier.status !== 'APPROVED') {
        await approveSupplier(supplier.id);
      }
      await createPurchaseOrder({
        supplierId: supplier.id,
        poNumber: poForm.poNumber.trim() || `PO-${Date.now().toString().slice(-5)}`,
        lines,
      });
      setPoOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create purchase order');
    } finally {
      setSavingPo(false);
    }
  }

  function updateLine(idx: number, patch: Partial<LineDraft>) {
    setPoForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }

  function addLine() {
    setPoForm((prev) => ({ ...prev, lines: [...prev.lines, { ...emptyLine }] }));
  }

  function removeLine(idx: number) {
    setPoForm((prev) => ({
      ...prev,
      lines:
        prev.lines.length > 1
          ? prev.lines.filter((_, i) => i !== idx)
          : prev.lines,
    }));
  }

  async function runSupplierApprove(s: Supplier) {
    setBusyId(s.id);
    setError(null);
    try {
      await approveSupplier(s.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runSupplierReject() {
    if (!rejectTarget || rejectReason.trim().length < 3) {
      setError('Rejection reason must be at least 3 characters');
      return;
    }
    setBusyId(rejectTarget.id);
    setError(null);
    try {
      await rejectSupplier(rejectTarget.id, rejectReason.trim());
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runSupplierSuspend(s: Supplier) {
    setBusyId(s.id);
    setError(null);
    try {
      await suspendSupplier(s.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suspend failed');
    } finally {
      setBusyId(null);
    }
  }

  async function openDocs(s: Supplier) {
    setDocsTarget(s);
    setDocsLoading(true);
    try {
      setDocs(
        await listDocuments({ resourceType: 'Supplier', resourceId: s.id }),
      );
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }

  async function uploadSupplierDoc(file: File) {
    if (!docsTarget) return;
    setBusyId(docsTarget.id);
    try {
      await uploadDocument({
        file,
        resourceType: 'Supplier',
        resourceId: docsTarget.id,
      });
      setDocs(
        await listDocuments({
          resourceType: 'Supplier',
          resourceId: docsTarget.id,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusyId(null);
    }
  }

  async function openMessages(s: Supplier) {
    setMsgTarget(s);
    setMsgBody('');
    setMsgLoading(true);
    try {
      setMessages(await listSupplierMessages(s.id));
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  }

  async function sendStaffMessage() {
    if (!msgTarget || msgBody.trim().length < 1) {
      setError('Write a reply first');
      return;
    }
    setBusyId(msgTarget.id);
    setError(null);
    try {
      await createSupplierMessage(msgTarget.id, msgBody.trim());
      setMsgBody('');
      setMessages(await listSupplierMessages(msgTarget.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runSubmissionApprove(row: SupplierSubmission) {
    setBusyId(row.id);
    setError(null);
    try {
      await approveSupplierSubmission(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runSubmissionReject() {
    if (!subRejectTarget || rejectReason.trim().length < 3) {
      setError('Rejection reason must be at least 3 characters');
      return;
    }
    setBusyId(subRejectTarget.id);
    setError(null);
    try {
      await rejectSupplierSubmission(subRejectTarget.id, rejectReason.trim());
      setSubRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runMarkPaid(row: SupplierSubmission) {
    setBusyId(row.id);
    setError(null);
    try {
      await markSupplierSubmissionPaid(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mark paid failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runPoSubmit(po: PurchaseOrder) {
    setBusyId(po.id);
    setError(null);
    try {
      await submitPurchaseOrder(po.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runPoApprove(po: PurchaseOrder) {
    setBusyId(po.id);
    setError(null);
    try {
      await approvePurchaseOrder(po.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  function canActPr(row: PurchaseRequest) {
    return isSuperAdmin || row.createdBy !== sessionUser?.id;
  }

  async function runCreatePr() {
    const qty = Number(prForm.quantity);
    if (!prForm.purpose.trim() || !prForm.description.trim() || qty <= 0) {
      setError('Purpose, description and quantity are required.');
      return;
    }
    setSavingPo(true);
    setError(null);
    try {
      await createPurchaseRequest({
        department: prForm.department.trim() || 'Operations',
        purpose: prForm.purpose.trim(),
        lines: [
          { description: prForm.description.trim(), quantity: qty },
        ],
      });
      setPrOpen(false);
      setPrForm({
        department: 'Operations',
        purpose: '',
        description: '',
        quantity: '1',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create PR');
    } finally {
      setSavingPo(false);
    }
  }

  async function runPrSubmit(row: PurchaseRequest) {
    setBusyId(row.id);
    setError(null);
    try {
      await submitPurchaseRequest(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runPrApprove(row: PurchaseRequest) {
    setBusyId(row.id);
    setError(null);
    try {
      await approvePurchaseRequest(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runPrReject() {
    if (!prReject) return;
    setBusyId(prReject.id);
    setError(null);
    try {
      const reason = prRejectReason.trim();
      if (reason.length < 3) {
        setError('Reject reason must be at least 3 characters.');
        setBusyId(null);
        return;
      }
      await rejectPurchaseRequest(prReject.id, reason);
      setPrReject(null);
      setPrRejectReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  function openCompare(row: PurchaseRequest) {
    const prices: Record<string, string> = {};
    for (const line of row.lines ?? []) prices[line.id] = '';
    setQuotePrices(prices);
    setQuoteSupplierId(approvedSuppliers[0]?.id ?? '');
    setComparePr(row);
  }

  async function runAddQuote() {
    if (!comparePr || !quoteSupplierId) return;
    const lines = (comparePr.lines ?? []).map((line) => ({
      purchaseRequestLineId: line.id,
      unitPrice: Number(quotePrices[line.id] ?? 0),
    }));
    if (lines.some((l) => !Number.isFinite(l.unitPrice) || l.unitPrice < 0)) {
      setError('Enter a unit price for every line.');
      return;
    }
    setBusyId(comparePr.id);
    setError(null);
    try {
      const updated = await addPurchaseRequestQuote(comparePr.id, {
        supplierId: quoteSupplierId,
        lines,
      });
      setComparePr(updated);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quote failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runAward(quoteId: string) {
    if (!comparePr) return;
    setBusyId(quoteId);
    setError(null);
    try {
      const updated = await awardPurchaseRequestQuote(comparePr.id, quoteId);
      setComparePr(updated);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Award failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runConvert(row: PurchaseRequest) {
    setBusyId(row.id);
    setError(null);
    try {
      await convertPurchaseRequest(row.id);
      setComparePr(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Convert failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buying"
        description="Purchase requests, supplier comparison, POs, and vendor submissions. GRNs and stock are on Inventory. Vendors use supplier-web (35.17)."
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              className={btnSecondary}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setPrOpen(true)}
              className={btnSecondary}
            >
              <Plus className="h-4 w-4" />
              New PR
            </button>
            <button
              type="button"
              onClick={openSupplierModal}
              className={btnSecondary}
            >
              <Plus className="h-4 w-4" />
              New supplier
            </button>
            <button type="button" onClick={openPoModal} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              New purchase order
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-md border-l-4 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Suppliers"
          value={suppliers.length}
          hint="Registered vendors"
          icon={<Truck className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Approved suppliers"
          value={stats.approved}
          hint={
            suppliers.length
              ? `${stats.approved} of ${suppliers.length} approved`
              : 'None yet'
          }
          icon={<BadgeCheck className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Purchase orders"
          value={pos.length}
          hint={`${stats.drafts} draft · ${stats.pending} pending approval`}
          icon={<ClipboardList className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Total PO value"
          value={money(stats.totalValue)}
          hint="Across all purchase orders"
          icon={<Wallet className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <section>
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#0078d4]" />
              <h2 className="text-[15px] font-semibold text-[#1b1a19]">
                Purchase requests
              </h2>
              <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
                {requests.length}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#605e5c]">
              Request → approve → compare quotes (≥2) → award → convert to PO
            </p>
          </div>
        </div>
        {loading && requests.length === 0 ? (
          <p className="text-sm text-[#605e5c]">Loading…</p>
        ) : requests.length === 0 ? (
          <ProcurementEmpty
            title="No purchase requests"
            description="Raise a PR, submit for GM approval, then compare supplier quotes."
            icon="po"
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#e1dfdd] bg-white">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Number</th>
                  <th className="px-3 py-2 font-semibold">Purpose</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Quotes</th>
                  <th className="px-3 py-2 font-semibold">PO</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((row) => {
                  const st = norm(row.status);
                  const busy = busyId === row.id;
                  return (
                    <tr key={row.id} className="border-t border-[#edebe9]">
                      <td className="px-3 py-2 font-medium">
                        {row.requestNumber}
                      </td>
                      <td className="px-3 py-2">
                        <div>{row.purpose}</div>
                        <div className="text-[11px] text-[#8a8886]">
                          {row.department}
                          {(row.lines ?? []).length
                            ? ` · ${(row.lines ?? [])
                                .map((l) => `${l.description} ×${l.quantity}`)
                                .join(', ')}`
                            : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {row.status.replaceAll('_', ' ')}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {(row.quotes ?? []).length}
                      </td>
                      <td className="px-3 py-2">{row.poNumber ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {st === 'draft' ? (
                            <button
                              type="button"
                              className={btnSecondary}
                              disabled={busy}
                              onClick={() => void runPrSubmit(row)}
                            >
                              Submit
                            </button>
                          ) : null}
                          {st === 'pending_approval' && canActPr(row) ? (
                            <>
                              <button
                                type="button"
                                className={btnPrimary}
                                disabled={busy}
                                onClick={() => void runPrApprove(row)}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className={btnSecondary}
                                disabled={busy}
                                onClick={() => {
                                  setPrRejectReason('');
                                  setPrReject(row);
                                }}
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          {st === 'draft' ||
                          st === 'pending_approval' ||
                          st === 'approved' ||
                          st === 'converted' ? (
                            <button
                              type="button"
                              className={btnSecondary}
                              onClick={() => openCompare(row)}
                            >
                              Compare
                            </button>
                          ) : null}
                          {st === 'approved' && row.awardedQuoteId ? (
                            <button
                              type="button"
                              className={btnPrimary}
                              disabled={busy}
                              onClick={() => void runConvert(row)}
                            >
                              Convert to PO
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-[#0078d4]" />
              <h2 className="text-[15px] font-semibold text-[#1b1a19]">
                Suppliers
              </h2>
              <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
                {filteredSuppliers.length}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#605e5c]">
              Onboard vendors · approve before raising purchase orders
            </p>
          </div>
        </div>

        <SupplierRoster
          rows={filteredSuppliers}
          loading={loading}
          busyId={busyId}
          sessionUserId={sessionUser?.id}
          isSuperAdmin={isSuperAdmin}
          onApprove={(s) => void runSupplierApprove(s)}
          onReject={(s) => {
            setRejectReason('');
            setRejectTarget(s);
          }}
          onSuspend={(s) => void runSupplierSuspend(s)}
          onDocs={(s) => void openDocs(s)}
          onMessages={(s) => void openMessages(s)}
          toolbar={
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
                <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
                <input
                  value={supplierQuery}
                  onChange={(e) => setSupplierQuery(e.target.value)}
                  placeholder="Search name, code, email…"
                  className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {SUPPLIER_FILTERS.map((f) => {
                  const active = supplierFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSupplierFilter(f.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-[#0078d4] text-white shadow-sm'
                          : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                      }`}
                    >
                      {f.label}
                      <span
                        className={`tabular-nums ${
                          active ? 'text-white/80' : 'text-[#a19f9d]'
                        }`}
                      >
                        {supplierCounts[f.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          }
          empty={
            <ProcurementEmpty
              title={
                suppliers.length === 0 ? 'No suppliers yet' : 'No matches'
              }
              description={
                suppliers.length === 0
                  ? 'Add your first vendor, then approve them before raising purchase orders.'
                  : 'Try another search or status filter.'
              }
              icon="truck"
            />
          }
        />
      </section>

      <section>
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#0078d4]" />
              <h2 className="text-[15px] font-semibold text-[#1b1a19]">
                Quotes, invoices &amp; payment requests
              </h2>
              <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
                {submissions.length}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#605e5c]">
              Approve or reject supplier documents · mark invoices paid
            </p>
          </div>
        </div>
        <SubmissionRoster
          rows={submissions}
          loading={loading}
          busyId={busyId}
          sessionUserId={sessionUser?.id}
          isSuperAdmin={isSuperAdmin}
          onApprove={(row) => void runSubmissionApprove(row)}
          onReject={(row) => {
            setRejectReason('');
            setSubRejectTarget(row);
          }}
          onMarkPaid={(row) => void runMarkPaid(row)}
          empty={
            <ProcurementEmpty
              title="No supplier submissions"
              description="Quotes, invoices, delivery notes and payment requests from the supplier portal appear here."
              icon="po"
            />
          }
        />
      </section>

      <section>
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#0078d4]" />
              <h2 className="text-[15px] font-semibold text-[#1b1a19]">
                Purchase orders
              </h2>
              <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
                {filteredPos.length}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#605e5c]">
              Raise POs · submit for approval · approve against approved
              suppliers
            </p>
          </div>
        </div>

        <PurchaseOrderRoster
          rows={filteredPos}
          loading={loading}
          supplierName={supplierNameMap}
          busyId={busyId}
          onSubmit={(po) => void runPoSubmit(po)}
          onApprove={(po) => void runPoApprove(po)}
          toolbar={
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
                <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
                <input
                  value={poQuery}
                  onChange={(e) => setPoQuery(e.target.value)}
                  placeholder="Search PO #, supplier…"
                  className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {PO_FILTERS.map((f) => {
                  const active = poFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPoFilter(f.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-[#0078d4] text-white shadow-sm'
                          : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                      }`}
                    >
                      {f.label}
                      <span
                        className={`tabular-nums ${
                          active ? 'text-white/80' : 'text-[#a19f9d]'
                        }`}
                      >
                        {poCounts[f.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          }
          empty={
            <ProcurementEmpty
              title={pos.length === 0 ? 'No purchase orders yet' : 'No matches'}
              description={
                pos.length === 0
                  ? 'Raise a PO against an approved supplier, then submit for approval.'
                  : 'Try another search or status filter.'
              }
              icon="po"
            />
          }
        />
      </section>

      {supplierOpen ? (
        <Modal
          title="New supplier"
          description="Register a vendor. Approve it before raising purchase orders."
          onClose={() => setSupplierOpen(false)}
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Code</span>
                <input
                  className={inputCls}
                  value={supplierForm.code}
                  placeholder="SUP-001"
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Name</span>
                <input
                  className={inputCls}
                  value={supplierForm.name}
                  placeholder="Acme Security Supplies"
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Email</span>
                <input
                  className={inputCls}
                  type="email"
                  value={supplierForm.email}
                  placeholder="sales@acme.co.tz"
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Phone</span>
                <input
                  className={inputCls}
                  value={supplierForm.phone}
                  placeholder="+255 700 000 000"
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">TIN</span>
                <input
                  className={inputCls}
                  value={supplierForm.tin}
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, tin: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">VRN</span>
                <input
                  className={inputCls}
                  value={supplierForm.vrn}
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, vrn: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Category</span>
                <select
                  className={inputCls}
                  value={supplierForm.category}
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, category: e.target.value }))
                  }
                >
                  <option value="GOODS">Goods</option>
                  <option value="SERVICES">Services</option>
                  <option value="BOTH">Goods and services</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Contact person</span>
                <input
                  className={inputCls}
                  value={supplierForm.contactPerson}
                  onChange={(e) =>
                    setSupplierForm((f) => ({
                      ...f,
                      contactPerson: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-[#323130]">Address</span>
                <input
                  className={inputCls}
                  value={supplierForm.address}
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setSupplierOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={savingSupplier}
                onClick={() => void submitSupplier()}
              >
                {savingSupplier ? 'Saving…' : 'Create supplier'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {poOpen ? (
        <Modal
          title="New purchase order"
          description="Raise a PO against a supplier. Unapproved suppliers are approved on submit."
          onClose={() => setPoOpen(false)}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Supplier</span>
                <select
                  className={inputCls}
                  value={poForm.supplierId}
                  onChange={(e) =>
                    setPoForm((f) => ({ ...f, supplierId: e.target.value }))
                  }
                >
                  <option value="">Select a supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.status === 'APPROVED' ? '' : ' (needs approval)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">PO number</span>
                <input
                  className={inputCls}
                  value={poForm.poNumber}
                  onChange={(e) =>
                    setPoForm((f) => ({ ...f, poNumber: e.target.value }))
                  }
                />
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-[#323130]">Lines</span>
                <button
                  type="button"
                  className="text-[#0067b8] hover:underline text-xs font-medium inline-flex items-center gap-1"
                  onClick={addLine}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add line
                </button>
              </div>
              <div className="space-y-2">
                {poForm.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_5rem_7rem_auto] items-center gap-2"
                  >
                    <input
                      className={inputCls}
                      value={line.description}
                      placeholder="Description"
                      onChange={(e) =>
                        updateLine(idx, { description: e.target.value })
                      }
                    />
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      value={line.quantity}
                      placeholder="Qty"
                      onChange={(e) =>
                        updateLine(idx, { quantity: e.target.value })
                      }
                    />
                    <input
                      className={inputCls}
                      type="number"
                      min={0}
                      value={line.unitPrice}
                      placeholder="Unit price"
                      onChange={(e) =>
                        updateLine(idx, { unitPrice: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Remove line"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-[#605e5c] transition hover:bg-[#f3f2f1] hover:text-rose-600 disabled:opacity-40"
                      disabled={poForm.lines.length === 1}
                      onClick={() => removeLine(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md bg-[#f3f9fd] px-4 py-3">
              <span className="text-sm font-medium text-[#605e5c]">
                Estimated total
              </span>
              <span className="text-lg font-semibold text-[#1b1a19]">
                {money(poTotalPreview)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setPoOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={savingPo}
                onClick={() => void submitPo()}
              >
                {savingPo ? 'Creating…' : 'Create purchase order'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {rejectTarget ? (
        <Modal
          title="Reject supplier"
          description={`${rejectTarget.name} (${rejectTarget.code})`}
          onClose={() => setRejectTarget(null)}
        >
          <label className="block text-sm">
            <span className="font-medium text-[#323130]">Reason</span>
            <textarea
              className={inputCls}
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={busyId === rejectTarget.id}
              onClick={() => void runSupplierReject()}
            >
              Reject
            </button>
          </div>
        </Modal>
      ) : null}

      {subRejectTarget ? (
        <Modal
          title="Reject submission"
          description={subRejectTarget.referenceNumber}
          onClose={() => setSubRejectTarget(null)}
        >
          <label className="block text-sm">
            <span className="font-medium text-[#323130]">Reason</span>
            <textarea
              className={inputCls}
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setSubRejectTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={busyId === subRejectTarget.id}
              onClick={() => void runSubmissionReject()}
            >
              Reject
            </button>
          </div>
        </Modal>
      ) : null}

      {docsTarget ? (
        <Modal
          title="Supplier documents"
          description={`${docsTarget.name} — licence, TIN, VRN`}
          onClose={() => setDocsTarget(null)}
        >
          {docsLoading ? (
            <p className="text-sm text-[#605e5c]">Loading…</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-[#605e5c]">No files yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {docs.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="text-[#0078d4] hover:underline"
                    onClick={() =>
                      void getDocumentDownloadUrl(d.id).then(({ url }) =>
                        window.open(url, '_blank', 'noopener,noreferrer'),
                      )
                    }
                  >
                    {d.fileName}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-4 block text-sm font-medium">
            Upload
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="mt-1 block w-full text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void uploadSupplierDoc(file);
              }}
            />
          </label>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setDocsTarget(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      ) : null}

      {msgTarget ? (
        <Modal
          title="Procurement messages"
          description={`${msgTarget.name} — vendor thread (Portal 35.17)`}
          onClose={() => setMsgTarget(null)}
        >
          {msgLoading ? (
            <p className="text-sm text-[#605e5c]">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-[#605e5c]">No messages yet.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-lg px-3 py-2 ${
                    m.authorType === 'PROCUREMENT'
                      ? 'bg-[#eff6fc]'
                      : 'bg-amber-50'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-[#605e5c]">
                    {m.authorType === 'PROCUREMENT'
                      ? m.authorName ?? 'Procurement'
                      : 'Supplier'}{' '}
                    · {new Date(m.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-4 block text-sm font-medium">
            Reply
            <textarea
              className={`${inputCls} mt-1`}
              rows={3}
              maxLength={2000}
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setMsgTarget(null)}
            >
              Close
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={busyId === msgTarget.id}
              onClick={() => void sendStaffMessage()}
            >
              Send
            </button>
          </div>
        </Modal>
      ) : null}

      {prOpen ? (
        <Modal
          title="New purchase request"
          description="Department request for goods. Submit for GM approval, then compare quotes."
          onClose={() => setPrOpen(false)}
        >
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="font-medium text-[#323130]">Department</span>
              <input
                className={inputCls}
                value={prForm.department}
                onChange={(e) =>
                  setPrForm((f) => ({ ...f, department: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[#323130]">Purpose</span>
              <input
                className={inputCls}
                value={prForm.purpose}
                onChange={(e) =>
                  setPrForm((f) => ({ ...f, purpose: e.target.value }))
                }
                placeholder="Uniform replenishment"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[#323130]">Item description</span>
              <input
                className={inputCls}
                value={prForm.description}
                onChange={(e) =>
                  setPrForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Security boots size 42"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[#323130]">Quantity</span>
              <input
                className={inputCls}
                type="number"
                min={1}
                value={prForm.quantity}
                onChange={(e) =>
                  setPrForm((f) => ({ ...f, quantity: e.target.value }))
                }
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setPrOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={savingPo}
                onClick={() => void runCreatePr()}
              >
                {savingPo ? 'Saving…' : 'Create request'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {prReject ? (
        <Modal
          title="Reject purchase request"
          description={prReject.requestNumber}
          onClose={() => setPrReject(null)}
        >
          <label className="block text-sm">
            <span className="font-medium text-[#323130]">Reason</span>
            <textarea
              className={inputCls}
              rows={3}
              value={prRejectReason}
              onChange={(e) => setPrRejectReason(e.target.value)}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setPrReject(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={busyId === prReject.id}
              onClick={() => void runPrReject()}
            >
              Reject
            </button>
          </div>
        </Modal>
      ) : null}

      {comparePr ? (
        <Modal
          title={`Compare quotes · ${comparePr.requestNumber}`}
          description="Add at least two approved-supplier quotes, then award (quote creator cannot award)."
          onClose={() => setComparePr(null)}
          size="lg"
        >
          <div className="space-y-4">
            <ul className="text-sm text-[#323130]">
              {(comparePr.lines ?? []).map((line) => (
                <li key={line.id}>
                  {line.description} × {line.quantity} {line.unit}
                </li>
              ))}
            </ul>
            {(comparePr.quotes ?? []).length ? (
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase text-[#605e5c]">
                  <tr>
                    <th className="py-1">Supplier</th>
                    <th className="py-1">Total</th>
                    <th className="py-1">Status</th>
                    <th className="py-1" />
                  </tr>
                </thead>
                <tbody>
                  {(comparePr.quotes ?? []).map((q) => (
                    <tr key={q.id} className="border-t border-[#edebe9]">
                      <td className="py-1.5">
                        {q.supplierName ?? q.supplierCode ?? q.supplierId}
                      </td>
                      <td className="py-1.5 tabular-nums">
                        {money(q.totalAmount)}
                      </td>
                      <td className="py-1.5">{q.status.replaceAll('_', ' ')}</td>
                      <td className="py-1.5">
                        {norm(comparePr.status) === 'approved' &&
                        q.status !== 'AWARDED' ? (
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={busyId === q.id}
                            onClick={() => void runAward(q.id)}
                          >
                            Award
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-[#605e5c]">No quotes yet.</p>
            )}
            {norm(comparePr.status) !== 'converted' ? (
              <div className="space-y-2 rounded-md border border-[#e1dfdd] p-3">
                <p className="text-sm font-medium">Add quote</p>
                <select
                  className={inputCls}
                  value={quoteSupplierId}
                  onChange={(e) => setQuoteSupplierId(e.target.value)}
                >
                  <option value="">Select approved supplier…</option>
                  {approvedSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {(comparePr.lines ?? []).map((line) => (
                  <label key={line.id} className="block text-sm">
                    <span className="text-[#605e5c]">
                      Unit price · {line.description}
                    </span>
                    <input
                      className={inputCls}
                      type="number"
                      min={0}
                      value={quotePrices[line.id] ?? ''}
                      onChange={(e) =>
                        setQuotePrices((p) => ({
                          ...p,
                          [line.id]: e.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busyId === comparePr.id}
                  onClick={() => void runAddQuote()}
                >
                  Save quote
                </button>
              </div>
            ) : null}
            <div className="flex justify-end">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setComparePr(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
