'use client';

import {
  createCustomerContact,
  createCustomerEmployee,
  createCustomerSite,
  getCustomer,
  getCustomerEmployeeSites,
  getCustomerOverview,
  getDocumentDownloadUrl,
  inviteCustomerEmployeePortal,
  inviteCustomerPortalUser,
  listBranches,
  listCustomerAssignedGuards,
  listCustomerContacts,
  listCustomerEmployees,
  listCustomerPortalUsers,
  listCustomers,
  listDocuments,
  setCustomerEmployeeSites,
  updateCustomer,
  updateCustomerContact,
  updateCustomerEmployee,
  updateCustomerSite,
  uploadDocument,
  type Branch,
  type Customer,
  type CustomerAssignedGuard,
  type CustomerContact,
  type CustomerContactRole,
  type CustomerEmployeeStaff,
  type CustomerOverview,
  type CustomerPortalUser,
  type CustomerSiteSummary,
  type DocumentObject,
  type InviteCustomerEmployeePortalResult,
  type InviteCustomerPortalUserResult,
  type UpdateCustomerBody,
} from '@pssms/api-client';
import { Modal, StatCard, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import {
  Building2,
  Copy,
  Download,
  FileText,
  KeyRound,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  UserRound,
  UserX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CustomerRoster,
  CustomersEmpty,
} from './_components/CustomerRoster';
import { CustomerRegisterWizard } from './_components/CustomerRegisterWizard';
import { CustomerOverviewPanel } from './_components/CustomerOverviewPanel';
import { CustomerReportPanel } from './_components/CustomerReportPanel';

type StatusFilter = 'all' | 'active' | 'prospect' | 'inactive';

const CONTACT_ROLES: { id: CustomerContactRole; label: string }[] = [
  { id: 'GENERAL', label: 'General' },
  { id: 'BILLING', label: 'Billing' },
  { id: 'OPERATIONS', label: 'Operations' },
  { id: 'SECURITY', label: 'Security' },
  { id: 'OTHER', label: 'Other' },
];

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'prospect', label: 'Prospect' },
  { id: 'inactive', label: 'Suspended' },
];

function formatApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    /* plain text */
  }
  return raw;
}

function opt(value: string): string | null {
  const t = value.trim();
  return t.length ? t : null;
}

export default function CustomersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const [detail, setDetail] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    tin: '',
    vrn: '',
    email: '',
    phone: '',
    address: '',
    contactPerson: '',
    contactDesignation: '',
    city: '',
    region: '',
    // Module 6-D commercial / billing
    slaLevel: 'STANDARD',
    paymentTerms: 'NET_30',
    paymentMethod: 'BANK_TRANSFER',
    bankName: '',
    accountNumber: '',
    creditLimit: '',
    currency: 'TZS',
    invoiceFrequency: 'MONTHLY',
    taxExempt: false,
    accountManagerName: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [portalUsers, setPortalUsers] = useState<CustomerPortalUser[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    phone: '',
  });
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] =
    useState<InviteCustomerPortalUserResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [customerDocs, setCustomerDocs] = useState<DocumentObject[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docsUploading, setDocsUploading] = useState(false);
  const [docsFile, setDocsFile] = useState<File | null>(null);

  const [overview, setOverview] = useState<CustomerOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [siteCreateOpen, setSiteCreateOpen] = useState(false);
  const [siteEdit, setSiteEdit] = useState<CustomerSiteSummary | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [siteForm, setSiteForm] = useState({
    branchId: '',
    code: '',
    name: '',
    address: '',
  });
  const [siteEditForm, setSiteEditForm] = useState({
    name: '',
    address: '',
    isActive: true,
  });
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);

  const [assignedGuards, setAssignedGuards] = useState<CustomerAssignedGuard[]>(
    [],
  );
  const [guardsLoading, setGuardsLoading] = useState(false);
  const [guardsError, setGuardsError] = useState<string | null>(null);
  const [guardsFilter, setGuardsFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [contactEdit, setContactEdit] = useState<CustomerContact | null>(null);
  const [contactForm, setContactForm] = useState({
    fullName: '',
    designation: '',
    role: 'GENERAL' as CustomerContactRole,
    email: '',
    phone: '',
    altPhone: '',
    isPrimary: false,
    notes: '',
  });
  const [contactEditForm, setContactEditForm] = useState({
    fullName: '',
    designation: '',
    role: 'GENERAL' as CustomerContactRole,
    email: '',
    phone: '',
    altPhone: '',
    isPrimary: false,
    isActive: true,
    notes: '',
  });
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<CustomerEmployeeStaff[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [empCreateOpen, setEmpCreateOpen] = useState(false);
  const [empEdit, setEmpEdit] = useState<CustomerEmployeeStaff | null>(null);
  const [empForm, setEmpForm] = useState({
    fullName: '',
    employeeNumber: '',
    email: '',
    phone: '',
    department: '',
    accessLevel: 'STANDARD' as 'STANDARD' | 'RESTRICTED' | 'ELEVATED',
    accessCardRef: '',
    biometricRef: '',
  });
  const [empEditForm, setEmpEditForm] = useState({
    fullName: '',
    employeeNumber: '',
    email: '',
    phone: '',
    department: '',
    accessLevel: 'STANDARD' as 'STANDARD' | 'RESTRICTED' | 'ELEVATED',
    accessCardRef: '',
    biometricRef: '',
    isActive: true,
  });
  const [empSaving, setEmpSaving] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);
  const [empInviteResult, setEmpInviteResult] =
    useState<InviteCustomerEmployeePortalResult | null>(null);
  const [empInviteCopied, setEmpInviteCopied] = useState(false);
  const [empSitesFor, setEmpSitesFor] = useState<CustomerEmployeeStaff | null>(
    null,
  );
  const [empSiteIds, setEmpSiteIds] = useState<string[]>([]);
  const [empSitesUnrestricted, setEmpSitesUnrestricted] = useState(true);
  const [empSitesLoading, setEmpSitesLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCustomers());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === 'ACTIVE' || (r.isActive && r.status !== 'PROSPECT')).length;
    const prospect = rows.filter((r) => r.status === 'PROSPECT').length;
    const withSites = rows.filter((r) => (r.siteCount ?? 0) > 0).length;
    const withContracts = rows.filter((r) => (r.contractCount ?? 0) > 0).length;
    return { total, active, prospect, withSites, withContracts };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'active' && r.status !== 'ACTIVE' && !(r.isActive && !r.status))
        return false;
      if (statusFilter === 'prospect' && r.status !== 'PROSPECT') return false;
      if (
        statusFilter === 'inactive' &&
        r.status !== 'SUSPENDED' &&
        r.status !== 'TERMINATED' &&
        r.isActive
      )
        return false;
      if (!q) return true;
      const hay = [
        r.code,
        r.name,
        r.tradingName,
        r.tin,
        r.email,
        r.billingEmail,
        r.phone,
        r.address,
        r.contactPerson,
        r.category,
        r.industry,
        ...(r.serviceTypes ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, statusFilter]);

  async function loadPortalUsers(customerId: string) {
    setPortalLoading(true);
    try {
      setPortalUsers(await listCustomerPortalUsers(customerId));
    } catch {
      setPortalUsers([]);
    } finally {
      setPortalLoading(false);
    }
  }

  async function loadCustomerDocs(customerId: string) {
    setDocsLoading(true);
    setDocsError(null);
    try {
      setCustomerDocs(
        await listDocuments({
          resourceType: 'Customer',
          resourceId: customerId,
        }),
      );
    } catch (err) {
      setCustomerDocs([]);
      setDocsError(formatApiError(err));
    } finally {
      setDocsLoading(false);
    }
  }

  async function loadOverview(customerId: string) {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      setOverview(await getCustomerOverview(customerId));
    } catch (err) {
      setOverview(null);
      setOverviewError(formatApiError(err));
    } finally {
      setOverviewLoading(false);
    }
  }

  async function loadAssignedGuards(
    customerId: string,
    status: 'ACTIVE' | 'ALL' = guardsFilter,
  ) {
    setGuardsLoading(true);
    setGuardsError(null);
    try {
      setAssignedGuards(
        await listCustomerAssignedGuards(customerId, { status }),
      );
    } catch (err) {
      setAssignedGuards([]);
      setGuardsError(formatApiError(err));
    } finally {
      setGuardsLoading(false);
    }
  }

  async function loadContacts(customerId: string) {
    setContactsLoading(true);
    setContactError(null);
    try {
      setContacts(await listCustomerContacts(customerId));
    } catch (err) {
      setContacts([]);
      setContactError(formatApiError(err));
    } finally {
      setContactsLoading(false);
    }
  }

  function openContactCreate() {
    setContactError(null);
    setContactForm({
      fullName: '',
      designation: '',
      role: 'GENERAL',
      email: '',
      phone: '',
      altPhone: '',
      isPrimary: false,
      notes: '',
    });
    setContactCreateOpen(true);
  }

  async function onCreateContact(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setContactError(null);
    setContactSaving(true);
    try {
      await createCustomerContact(detail.id, {
        fullName: contactForm.fullName.trim(),
        designation: opt(contactForm.designation) ?? undefined,
        role: contactForm.role,
        email: opt(contactForm.email) ?? undefined,
        phone: opt(contactForm.phone) ?? undefined,
        altPhone: opt(contactForm.altPhone) ?? undefined,
        isPrimary: contactForm.isPrimary,
        notes: opt(contactForm.notes) ?? undefined,
      });
      setContactCreateOpen(false);
      await loadContacts(detail.id);
      if (contactForm.isPrimary) {
        const full = await getCustomer(detail.id);
        setDetail(full);
      }
    } catch (err) {
      setContactError(formatApiError(err));
    } finally {
      setContactSaving(false);
    }
  }

  function openContactEdit(c: CustomerContact) {
    setContactError(null);
    setContactEdit(c);
    setContactEditForm({
      fullName: c.fullName,
      designation: c.designation ?? '',
      role: c.role,
      email: c.email ?? '',
      phone: c.phone ?? '',
      altPhone: c.altPhone ?? '',
      isPrimary: c.isPrimary,
      isActive: c.isActive !== false,
      notes: c.notes ?? '',
    });
  }

  async function onUpdateContact(e: FormEvent) {
    e.preventDefault();
    if (!detail || !contactEdit) return;
    setContactError(null);
    setContactSaving(true);
    try {
      await updateCustomerContact(detail.id, contactEdit.id, {
        fullName: contactEditForm.fullName.trim(),
        designation: opt(contactEditForm.designation),
        role: contactEditForm.role,
        email: opt(contactEditForm.email),
        phone: opt(contactEditForm.phone),
        altPhone: opt(contactEditForm.altPhone),
        isPrimary: contactEditForm.isPrimary,
        isActive: contactEditForm.isActive,
        notes: opt(contactEditForm.notes),
      });
      setContactEdit(null);
      await loadContacts(detail.id);
      if (contactEditForm.isPrimary) {
        const full = await getCustomer(detail.id);
        setDetail(full);
      }
    } catch (err) {
      setContactError(formatApiError(err));
    } finally {
      setContactSaving(false);
    }
  }

  async function onToggleContactActive(c: CustomerContact) {
    if (!detail) return;
    setContactError(null);
    setContactSaving(true);
    try {
      await updateCustomerContact(detail.id, c.id, {
        isActive: c.isActive === false,
      });
      await loadContacts(detail.id);
    } catch (err) {
      setContactError(formatApiError(err));
    } finally {
      setContactSaving(false);
    }
  }

  async function loadEmployees(customerId: string) {
    setEmployeesLoading(true);
    setEmpError(null);
    try {
      setEmployees(await listCustomerEmployees(customerId));
    } catch (err) {
      setEmployees([]);
      setEmpError(formatApiError(err));
    } finally {
      setEmployeesLoading(false);
    }
  }

  function openEmpCreate() {
    setEmpError(null);
    setEmpForm({
      fullName: '',
      employeeNumber: '',
      email: '',
      phone: '',
      department: '',
      accessLevel: 'STANDARD',
      accessCardRef: '',
      biometricRef: '',
    });
    setEmpCreateOpen(true);
  }

  async function onCreateEmployee(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setEmpError(null);
    setEmpSaving(true);
    try {
      await createCustomerEmployee(detail.id, {
        fullName: empForm.fullName.trim(),
        employeeNumber: opt(empForm.employeeNumber) ?? undefined,
        email: opt(empForm.email) ?? undefined,
        phone: opt(empForm.phone) ?? undefined,
        department: opt(empForm.department) ?? undefined,
        accessLevel: empForm.accessLevel,
        accessCardRef: opt(empForm.accessCardRef) ?? undefined,
        biometricRef: opt(empForm.biometricRef) ?? undefined,
      });
      setEmpCreateOpen(false);
      await loadEmployees(detail.id);
      void loadOverview(detail.id);
    } catch (err) {
      setEmpError(formatApiError(err));
    } finally {
      setEmpSaving(false);
    }
  }

  function openEmpEdit(emp: CustomerEmployeeStaff) {
    setEmpError(null);
    setEmpEdit(emp);
    setEmpEditForm({
      fullName: emp.fullName,
      employeeNumber: emp.employeeNumber ?? '',
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      department: emp.department ?? '',
      accessLevel: emp.accessLevel ?? 'STANDARD',
      accessCardRef: emp.accessCardRef ?? '',
      biometricRef: emp.biometricRef ?? '',
      isActive: emp.isActive !== false,
    });
  }

  async function onUpdateEmployee(e: FormEvent) {
    e.preventDefault();
    if (!detail || !empEdit) return;
    setEmpError(null);
    setEmpSaving(true);
    try {
      await updateCustomerEmployee(detail.id, empEdit.id, {
        fullName: empEditForm.fullName.trim(),
        employeeNumber: opt(empEditForm.employeeNumber),
        email: opt(empEditForm.email),
        phone: opt(empEditForm.phone),
        department: opt(empEditForm.department),
        accessLevel: empEditForm.accessLevel,
        accessCardRef: opt(empEditForm.accessCardRef),
        biometricRef: opt(empEditForm.biometricRef),
        isActive: empEditForm.isActive,
      });
      setEmpEdit(null);
      await loadEmployees(detail.id);
      void loadOverview(detail.id);
    } catch (err) {
      setEmpError(formatApiError(err));
    } finally {
      setEmpSaving(false);
    }
  }

  async function openEmpSites(emp: CustomerEmployeeStaff) {
    if (!detail) return;
    setEmpError(null);
    setEmpSitesLoading(true);
    setEmpSitesFor(emp);
    try {
      const pack = await getCustomerEmployeeSites(detail.id, emp.id);
      setEmpSitesUnrestricted(pack.unrestricted);
      setEmpSiteIds(pack.unrestricted ? [] : pack.siteIds);
    } catch (err) {
      setEmpError(formatApiError(err));
      setEmpSitesFor(null);
    } finally {
      setEmpSitesLoading(false);
    }
  }

  async function onSaveEmpSites(e: FormEvent) {
    e.preventDefault();
    if (!detail || !empSitesFor) return;
    setEmpError(null);
    setEmpSaving(true);
    try {
      const pack = await setCustomerEmployeeSites(
        detail.id,
        empSitesFor.id,
        empSitesUnrestricted ? [] : empSiteIds,
      );
      setEmpSitesUnrestricted(pack.unrestricted);
      setEmpSiteIds(pack.unrestricted ? [] : pack.siteIds);
      setEmpSitesFor(null);
    } catch (err) {
      setEmpError(formatApiError(err));
    } finally {
      setEmpSaving(false);
    }
  }

  async function onToggleEmployeeActive(emp: CustomerEmployeeStaff) {
    if (!detail) return;
    setEmpError(null);
    setEmpSaving(true);
    try {
      await updateCustomerEmployee(detail.id, emp.id, {
        isActive: emp.isActive === false,
      });
      await loadEmployees(detail.id);
      void loadOverview(detail.id);
    } catch (err) {
      setEmpError(formatApiError(err));
    } finally {
      setEmpSaving(false);
    }
  }

  async function onInviteEmployeePortal(emp: CustomerEmployeeStaff) {
    if (!detail) return;
    setEmpError(null);
    setEmpInviteResult(null);
    setEmpSaving(true);
    try {
      const res = await inviteCustomerEmployeePortal(detail.id, emp.id);
      setEmpInviteResult(res);
      await loadEmployees(detail.id);
      void loadPortalUsers(detail.id);
    } catch (err) {
      setEmpError(formatApiError(err));
    } finally {
      setEmpSaving(false);
    }
  }

  async function openSiteCreate() {
    if (!detail) return;
    setSiteError(null);
    setSiteCreateOpen(true);
    try {
      const br = await listBranches();
      setBranches(br);
      setSiteForm({
        branchId: detail.branchId ?? br[0]?.id ?? '',
        code: '',
        name: '',
        address: '',
      });
    } catch (err) {
      setSiteError(formatApiError(err));
    }
  }

  async function onCreateSite(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setSiteError(null);
    setSiteSaving(true);
    try {
      await createCustomerSite(detail.id, {
        branchId: siteForm.branchId,
        code: siteForm.code.trim(),
        name: siteForm.name.trim(),
        address: opt(siteForm.address) ?? undefined,
      });
      setSiteCreateOpen(false);
      const full = await getCustomer(detail.id);
      setDetail(full);
      void loadOverview(detail.id);
      await refresh();
    } catch (err) {
      setSiteError(formatApiError(err));
    } finally {
      setSiteSaving(false);
    }
  }

  function openSiteEdit(site: CustomerSiteSummary) {
    setSiteError(null);
    setSiteEdit(site);
    setSiteEditForm({
      name: site.name,
      address: site.address ?? '',
      isActive: site.isActive !== false,
    });
  }

  async function onUpdateSite(e: FormEvent) {
    e.preventDefault();
    if (!detail || !siteEdit) return;
    setSiteError(null);
    setSiteSaving(true);
    try {
      await updateCustomerSite(detail.id, siteEdit.id, {
        name: siteEditForm.name.trim(),
        address: opt(siteEditForm.address),
        isActive: siteEditForm.isActive,
      });
      setSiteEdit(null);
      const full = await getCustomer(detail.id);
      setDetail(full);
      void loadOverview(detail.id);
      await refresh();
    } catch (err) {
      setSiteError(formatApiError(err));
    } finally {
      setSiteSaving(false);
    }
  }

  async function onToggleSiteActive(site: CustomerSiteSummary) {
    if (!detail) return;
    setSiteError(null);
    setSiteSaving(true);
    try {
      await updateCustomerSite(detail.id, site.id, {
        isActive: site.isActive === false,
      });
      const full = await getCustomer(detail.id);
      setDetail(full);
      void loadOverview(detail.id);
      await refresh();
    } catch (err) {
      setSiteError(formatApiError(err));
    } finally {
      setSiteSaving(false);
    }
  }

  async function openDetail(row: Customer) {
    setDetail(row);
    setEditMode(false);
    setEditError(null);
    setInviteOpen(false);
    setInviteResult(null);
    setInviteError(null);
    setDocsFile(null);
    setDocsError(null);
    setOverview(null);
    setOverviewError(null);
    setSiteCreateOpen(false);
    setSiteEdit(null);
    setSiteError(null);
    setEmpCreateOpen(false);
    setEmpEdit(null);
    setEmpError(null);
    setEmpInviteResult(null);
    setEmployees([]);
    setAssignedGuards([]);
    setGuardsError(null);
    setGuardsFilter('ACTIVE');
    setContacts([]);
    setContactCreateOpen(false);
    setContactEdit(null);
    setContactError(null);
    setDetailLoading(true);
    void loadPortalUsers(row.id);
    void loadCustomerDocs(row.id);
    void loadOverview(row.id);
    void loadAssignedGuards(row.id, 'ACTIVE');
    void loadContacts(row.id);
    void loadEmployees(row.id);
    try {
      const full = await getCustomer(row.id);
      setDetail(full);
      setEditForm({
        name: full.name,
        tin: full.tin ?? '',
        vrn: full.vrn ?? '',
        email: full.billingEmail ?? full.email ?? '',
        phone: full.phone ?? '',
        address: full.address ?? '',
        contactPerson: full.contactPerson ?? '',
        contactDesignation: full.contactDesignation ?? '',
        city: full.city ?? '',
        region: full.region ?? '',
        slaLevel: full.slaLevel ?? 'STANDARD',
        paymentTerms: full.paymentTerms ?? 'NET_30',
        paymentMethod: full.paymentMethod ?? 'BANK_TRANSFER',
        bankName: full.bankName ?? '',
        accountNumber: full.accountNumber ?? '',
        creditLimit:
          full.creditLimit != null && full.creditLimit !== ''
            ? String(full.creditLimit)
            : '',
        currency: full.currency ?? 'TZS',
        invoiceFrequency: full.invoiceFrequency ?? 'MONTHLY',
        taxExempt: Boolean(full.taxExempt),
        accountManagerName: full.accountManagerName ?? '',
      });
      setInviteForm({
        email: full.billingEmail ?? full.email ?? '',
        fullName: full.contactPerson
          ? `${full.contactPerson} (Portal)`
          : `${full.name} Portal`,
        phone: full.phone ?? '',
      });
    } catch (err) {
      setEditError(formatApiError(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function onUploadCustomerDoc(e: FormEvent) {
    e.preventDefault();
    if (!detail || !docsFile) {
      setDocsError('Choose a file (pdf, png, jpeg, or webp — max 10MB)');
      return;
    }
    setDocsUploading(true);
    setDocsError(null);
    try {
      await uploadDocument({
        file: docsFile,
        resourceType: 'Customer',
        resourceId: detail.id,
      });
      setDocsFile(null);
      await loadCustomerDocs(detail.id);
    } catch (err) {
      setDocsError(formatApiError(err));
    } finally {
      setDocsUploading(false);
    }
  }

  async function onDownloadCustomerDoc(doc: DocumentObject) {
    setDocsError(null);
    try {
      const { url } = await getDocumentDownloadUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDocsError(formatApiError(err));
    }
  }

  async function onInvitePortal(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setInviteError(null);
    setInviteSaving(true);
    try {
      const res = await inviteCustomerPortalUser(detail.id, {
        email: inviteForm.email.trim(),
        fullName: inviteForm.fullName.trim(),
        phone: opt(inviteForm.phone) ?? undefined,
      });
      setInviteResult(res);
      setInviteOpen(false);
      await loadPortalUsers(detail.id);
    } catch (err) {
      setInviteError(formatApiError(err));
    } finally {
      setInviteSaving(false);
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setEditError(null);
    setSaving(true);
    const creditRaw = editForm.creditLimit.trim();
    const creditLimit =
      creditRaw === ''
        ? null
        : Number.isFinite(Number(creditRaw))
          ? Number(creditRaw)
          : null;
    const body: UpdateCustomerBody = {
      name: editForm.name.trim(),
      tin: opt(editForm.tin),
      vrn: opt(editForm.vrn),
      billingEmail: opt(editForm.email),
      email: opt(editForm.email),
      phone: opt(editForm.phone),
      address: opt(editForm.address),
      contactPerson: opt(editForm.contactPerson),
      contactDesignation: opt(editForm.contactDesignation),
      city: opt(editForm.city),
      region: opt(editForm.region),
      slaLevel: opt(editForm.slaLevel) ?? 'STANDARD',
      paymentTerms: opt(editForm.paymentTerms) ?? 'NET_30',
      paymentMethod: opt(editForm.paymentMethod),
      bankName: opt(editForm.bankName),
      accountNumber: opt(editForm.accountNumber),
      creditLimit,
      currency: opt(editForm.currency) ?? 'TZS',
      invoiceFrequency: opt(editForm.invoiceFrequency) ?? 'MONTHLY',
      taxExempt: editForm.taxExempt,
      accountManagerName: opt(editForm.accountManagerName),
    };
    try {
      const updated = await updateCustomer(detail.id, body);
      setDetail(updated);
      setEditForm({
        name: updated.name,
        tin: updated.tin ?? '',
        vrn: updated.vrn ?? '',
        email: updated.billingEmail ?? updated.email ?? '',
        phone: updated.phone ?? '',
        address: updated.address ?? '',
        contactPerson: updated.contactPerson ?? '',
        contactDesignation: updated.contactDesignation ?? '',
        city: updated.city ?? '',
        region: updated.region ?? '',
        slaLevel: updated.slaLevel ?? 'STANDARD',
        paymentTerms: updated.paymentTerms ?? 'NET_30',
        paymentMethod: updated.paymentMethod ?? 'BANK_TRANSFER',
        bankName: updated.bankName ?? '',
        accountNumber: updated.accountNumber ?? '',
        creditLimit:
          updated.creditLimit != null && updated.creditLimit !== ''
            ? String(updated.creditLimit)
            : '',
        currency: updated.currency ?? 'TZS',
        invoiceFrequency: updated.invoiceFrequency ?? 'MONTHLY',
        taxExempt: Boolean(updated.taxExempt),
        accountManagerName: updated.accountManagerName ?? '',
      });
      setEditMode(false);
      await refresh();
    } catch (err) {
      setEditError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!detail) return;
    setSaving(true);
    setEditError(null);
    try {
      const suspend = detail.status === 'ACTIVE' || detail.isActive;
      const updated = await updateCustomer(detail.id, {
        status: suspend ? 'SUSPENDED' : 'ACTIVE',
        isActive: !suspend,
      });
      setDetail(updated);
      await refresh();
    } catch (err) {
      setEditError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1f3a] via-[#0e2f52] to-[#0d9488] px-6 py-7 text-white shadow-lg">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #fff 0, transparent 45%), radial-gradient(circle at 80% 0%, #5eead4 0, transparent 40%)',
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-100/90">
              Super Admin · Module 6
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Customer Management
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-200/90">
              Full commercial registration (company → contacts → services →
              billing). Sites and contracts follow after create.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#0b1f3a] hover:bg-teal-50"
            >
              <Plus className="h-4 w-4" />
              New customer
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total customers"
          value={stats.total}
          hint="All registered accounts"
          accent="blue"
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={stats.active}
          hint="Live commercial accounts"
          accent="emerald"
          icon={<UserCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Prospects"
          value={stats.prospect}
          hint="Draft / pipeline"
          accent="amber"
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          label="With sites"
          value={stats.withSites}
          hint="Linked enterprise sites"
          accent="sky"
          icon={<MapPin className="h-5 w-5" />}
        />
      </div>

      <CustomerRoster
        rows={filtered}
        loading={loading}
        onOpen={(row) => void openDetail(row)}
        empty={
          <CustomersEmpty onCreate={() => setCreateOpen(true)} />
        }
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a19f9d]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search code, name, TIN, services…"
                className="w-full rounded-lg border border-[#e1dfdd] bg-white py-2 pl-9 pr-3 text-sm text-[#323130] outline-none ring-[#0078d4] focus:ring-2"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={
                    statusFilter === f.id
                      ? 'rounded-full bg-[#0078d4] px-3 py-1 text-xs font-semibold text-white'
                      : 'rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f2f1]'
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <p className="text-xs text-[#605e5c]">
        After register: add sites under{' '}
        <Link href="/branch/sites" className="font-semibold text-[#0078d4] hover:underline">
          Branch → Sites
        </Link>
        , then a{' '}
        <Link
          href="/superadmin/contracts"
          className="font-semibold text-[#0078d4] hover:underline"
        >
          contract
        </Link>
        . Portal invite and documents are on the customer drawer.
      </p>

      {createOpen ? (
        <CustomerRegisterWizard
          onClose={() => setCreateOpen(false)}
          onCreated={(customer, goContract) => {
            void refresh();
            if (goContract) {
              setCreateOpen(false);
              router.push(`/superadmin/contracts?customerId=${customer.id}`);
            }
          }}
        />
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close drawer"
            onClick={() => setDetail(null)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#edebe9] px-5 py-4">
              <div>
                <p className="font-mono text-[11px] text-[#605e5c]">{detail.code}</p>
                <h2 className="text-lg font-bold text-[#1b1a19]">{detail.name}</h2>
                <p className="mt-0.5 text-xs text-[#605e5c]">
                  {detail.status ?? (detail.isActive ? 'ACTIVE' : 'SUSPENDED')}
                  {detail.category ? ` · ${detail.category}` : ''}
                  {detail.ranking ? ` · ${detail.ranking}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg p-1.5 text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <p className="text-sm text-[#605e5c]">Loading…</p>
              ) : editMode ? (
                <form onSubmit={onSaveEdit} className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                    Profile
                  </p>
                  {(
                    [
                      ['name', 'Company name'],
                      ['tin', 'TIN'],
                      ['vrn', 'VRN'],
                      ['contactPerson', 'Contact person'],
                      ['contactDesignation', 'Designation'],
                      ['email', 'Billing email'],
                      ['phone', 'Phone'],
                      ['city', 'City'],
                      ['region', 'Region'],
                      ['address', 'Address'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="block text-sm font-medium text-[#323130]"
                    >
                      {label}
                      {key === 'address' ? (
                        <textarea
                          value={editForm[key]}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, [key]: e.target.value }))
                          }
                          className={`${inputCls} min-h-[64px] resize-y`}
                          rows={2}
                        />
                      ) : (
                        <input
                          value={editForm[key]}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, [key]: e.target.value }))
                          }
                          className={inputCls}
                          required={key === 'name'}
                        />
                      )}
                    </label>
                  ))}

                  <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                    Billing &amp; commercial
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-[#323130]">
                      Payment terms
                      <select
                        value={editForm.paymentTerms}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            paymentTerms: e.target.value,
                          }))
                        }
                        className={inputCls}
                      >
                        <option value="NET_15">Net 15</option>
                        <option value="NET_30">Net 30</option>
                        <option value="NET_45">Net 45</option>
                        <option value="NET_60">Net 60</option>
                        <option value="PREPAID">Prepaid</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-[#323130]">
                      Payment method
                      <select
                        value={editForm.paymentMethod}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            paymentMethod: e.target.value,
                          }))
                        }
                        className={inputCls}
                      >
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="MOBILE_MONEY">Mobile money</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="CASH">Cash</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-[#323130]">
                      SLA level
                      <select
                        value={editForm.slaLevel}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, slaLevel: e.target.value }))
                        }
                        className={inputCls}
                      >
                        <option value="STANDARD">Standard</option>
                        <option value="PREMIUM">Premium</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-[#323130]">
                      Invoice frequency
                      <select
                        value={editForm.invoiceFrequency}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            invoiceFrequency: e.target.value,
                          }))
                        }
                        className={inputCls}
                      >
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-[#323130]">
                      Currency
                      <select
                        value={editForm.currency}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, currency: e.target.value }))
                        }
                        className={inputCls}
                      >
                        <option value="TZS">TZS</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="KES">KES</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-[#323130]">
                      Credit limit
                      <input
                        type="number"
                        min={0}
                        value={editForm.creditLimit}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            creditLimit: e.target.value,
                          }))
                        }
                        className={inputCls}
                        placeholder="Optional"
                      />
                    </label>
                    <label className="block text-sm font-medium text-[#323130]">
                      Bank name
                      <input
                        value={editForm.bankName}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, bankName: e.target.value }))
                        }
                        className={inputCls}
                      />
                    </label>
                    <label className="block text-sm font-medium text-[#323130]">
                      Account number
                      <input
                        value={editForm.accountNumber}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            accountNumber: e.target.value,
                          }))
                        }
                        className={inputCls}
                      />
                    </label>
                  </div>
                  <label className="block text-sm font-medium text-[#323130]">
                    Account manager
                    <input
                      value={editForm.accountManagerName}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          accountManagerName: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#323130]">
                    <input
                      type="checkbox"
                      checked={editForm.taxExempt}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          taxExempt: e.target.checked,
                        }))
                      }
                      className="rounded border-[#8a8886]"
                    />
                    Tax exempt
                  </label>

                  {editError ? (
                    <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {editError}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className={btnSecondary}
                    >
                      Cancel
                    </button>
                    <button type="submit" className={btnPrimary} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5">
                  <dl className="grid gap-3 text-sm">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Industry
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {detail.industry ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        TIN / VRN
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {detail.tin ?? '—'}
                        {detail.vrn ? ` · ${detail.vrn}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Contact
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-[#323130]">
                        <UserRound className="h-3.5 w-3.5 text-[#a19f9d]" />
                        {detail.contactPerson ?? '—'}
                        {detail.contactDesignation
                          ? ` — ${detail.contactDesignation}`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Billing email
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {detail.billingEmail ?? detail.email ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Address
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {[detail.address, detail.city, detail.region, detail.country]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Services
                      </dt>
                      <dd className="mt-1 text-[#323130]">
                        {(detail.serviceTypes ?? []).join(', ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Commercial
                      </dt>
                      <dd className="mt-1 space-y-1 text-[#323130]">
                        <p>
                          {[
                            detail.paymentTerms,
                            detail.paymentMethod,
                            detail.invoiceFrequency,
                            detail.currency,
                            detail.slaLevel,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                        <p className="text-[#605e5c]">
                          Bank:{' '}
                          {[detail.bankName, detail.accountNumber]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                          {detail.creditLimit != null && detail.creditLimit !== ''
                            ? ` · Credit ${detail.creditLimit}`
                            : ''}
                          {detail.taxExempt ? ' · Tax exempt' : ''}
                        </p>
                        {detail.accountManagerName ? (
                          <p className="text-[#605e5c]">
                            AM: {detail.accountManagerName}
                          </p>
                        ) : null}
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Linked sites (
                        {detail.sites?.length ?? detail.siteCount ?? 0})
                      </h3>
                      <button
                        type="button"
                        onClick={() => void openSiteCreate()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add site
                      </button>
                    </div>
                    {siteError && !siteCreateOpen && !siteEdit ? (
                      <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {siteError}
                      </p>
                    ) : null}
                    {detail.sites && detail.sites.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {detail.sites.map((s) => (
                          <li
                            key={s.id}
                            className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-[#323130]">
                                  {s.name}
                                </p>
                                <p className="font-mono text-[11px] text-[#605e5c]">
                                  {s.code}
                                  {s.isActive === false ? ' · inactive' : ''}
                                </p>
                                {s.address ? (
                                  <p className="mt-0.5 truncate text-[11px] text-[#605e5c]">
                                    {s.address}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openSiteEdit(s)}
                                  className="text-xs font-semibold text-[#0078d4] hover:underline"
                                  disabled={siteSaving}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onToggleSiteActive(s)}
                                  className="text-xs font-semibold text-[#605e5c] hover:text-[#323130] hover:underline"
                                  disabled={siteSaving}
                                >
                                  {s.isActive === false
                                    ? 'Reactivate'
                                    : 'Deactivate'}
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-[#605e5c]">
                        No sites yet — use Add site, or{' '}
                        <Link
                          href="/branch/sites"
                          className="font-semibold text-[#0078d4] hover:underline"
                        >
                          Branch → Sites
                        </Link>
                        .
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Contacts ({contacts.length})
                      </h3>
                      <button
                        type="button"
                        onClick={openContactCreate}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add contact
                      </button>
                    </div>
                    {contactError && !contactCreateOpen && !contactEdit ? (
                      <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {contactError}
                      </p>
                    ) : null}
                    {contactsLoading ? (
                      <p className="mt-2 text-xs text-[#605e5c]">Loading…</p>
                    ) : contacts.length === 0 ? (
                      <p className="mt-2 text-xs text-[#605e5c]">
                        No contacts yet — add billing, ops, or security
                        contacts (primary syncs profile contact person).
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                        {contacts.map((c) => (
                          <li
                            key={c.id}
                            className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-[#323130]">
                                  {c.fullName}
                                  {c.isPrimary ? (
                                    <span className="ml-1 text-[11px] font-normal text-[#0078d4]">
                                      primary
                                    </span>
                                  ) : null}
                                  {c.isActive === false ? (
                                    <span className="ml-1 text-[11px] font-normal text-[#a19f9d]">
                                      inactive
                                    </span>
                                  ) : null}
                                </p>
                                <p className="text-[11px] text-[#605e5c]">
                                  {[
                                    c.role.toLowerCase(),
                                    c.designation,
                                    c.email,
                                    c.phone,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openContactEdit(c)}
                                  className="text-xs font-semibold text-[#0078d4] hover:underline"
                                  disabled={contactSaving}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onToggleContactActive(c)}
                                  className="text-xs font-semibold text-[#605e5c] hover:text-[#323130] hover:underline"
                                  disabled={contactSaving}
                                >
                                  {c.isActive === false
                                    ? 'Reactivate'
                                    : 'Deactivate'}
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Assigned guards ({assignedGuards.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!detail) return;
                            const next =
                              guardsFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE';
                            setGuardsFilter(next);
                            void loadAssignedGuards(detail.id, next);
                          }}
                          className="text-[11px] font-semibold text-[#605e5c] hover:text-[#323130] hover:underline"
                        >
                          {guardsFilter === 'ACTIVE' ? 'Show all' : 'Active only'}
                        </button>
                        <Link
                          href="/operations/guards"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                        >
                          <Shield className="h-3.5 w-3.5" />
                          Ops
                        </Link>
                      </div>
                    </div>
                    {guardsError ? (
                      <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {guardsError}
                      </p>
                    ) : null}
                    {guardsLoading ? (
                      <p className="mt-2 text-xs text-[#605e5c]">Loading…</p>
                    ) : assignedGuards.length === 0 ? (
                      <p className="mt-2 text-xs text-[#605e5c]">
                        No{' '}
                        {guardsFilter === 'ACTIVE' ? 'active ' : ''}
                        deployments on this customer&apos;s sites — assign via{' '}
                        <Link
                          href="/branch"
                          className="font-semibold text-[#0078d4] hover:underline"
                        >
                          Branch Ops
                        </Link>
                        .
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                        {assignedGuards.map((g) => (
                          <li
                            key={g.deploymentId}
                            className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm"
                          >
                            <p className="font-semibold text-[#323130]">
                              {g.fullName ?? g.guardNumber}
                              {g.deploymentStatus !== 'ACTIVE' ? (
                                <span className="ml-1 text-[11px] font-normal text-[#a19f9d]">
                                  {g.deploymentStatus.toLowerCase()}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-[11px] text-[#605e5c]">
                              {[
                                g.guardNumber,
                                `${g.siteCode} · ${g.siteName}`,
                                g.contractNumber,
                                `from ${g.startDate}`,
                                g.endDate ? `to ${g.endDate}` : null,
                                g.guardStatus !== 'ACTIVE'
                                  ? `guard ${g.guardStatus.toLowerCase()}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Customer employees ({employees.length})
                      </h3>
                      <button
                        type="button"
                        onClick={openEmpCreate}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add employee
                      </button>
                    </div>
                    {empError && !empCreateOpen && !empEdit && !empSitesFor ? (
                      <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {empError}
                      </p>
                    ) : null}
                    {employeesLoading ? (
                      <p className="mt-2 text-xs text-[#605e5c]">Loading…</p>
                    ) : employees.length === 0 ? (
                      <p className="mt-2 text-xs text-[#605e5c]">
                        No customer employees yet — register staff for access
                        control, then invite a portal login when email is set.
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                        {employees.map((e) => (
                          <li
                            key={e.id}
                            className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-[#323130]">
                                  {e.fullName}
                                  {e.isActive === false ? (
                                    <span className="ml-1 text-[11px] font-normal text-[#a19f9d]">
                                      inactive
                                    </span>
                                  ) : null}
                                </p>
                                <p className="text-[11px] text-[#605e5c]">
                                  {[
                                    e.employeeNumber,
                                    e.department,
                                    e.accessLevel
                                      ? `level ${e.accessLevel}`
                                      : null,
                                    e.email,
                                    e.accessCardRef
                                      ? `card ${e.accessCardRef}`
                                      : null,
                                    e.biometricRef
                                      ? `bio ${e.biometricRef}`
                                      : null,
                                    e.userId
                                      ? e.isActive === false
                                        ? 'portal login suspended'
                                        : 'portal-linked'
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEmpEdit(e)}
                                  className="text-xs font-semibold text-[#0078d4] hover:underline"
                                  disabled={empSaving}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void openEmpSites(e)}
                                  className="text-xs font-semibold text-[#0078d4] hover:underline"
                                  disabled={empSaving || empSitesLoading}
                                >
                                  Sites
                                </button>
                                {!e.userId && e.email && e.isActive !== false ? (
                                  <button
                                    type="button"
                                    onClick={() => void onInviteEmployeePortal(e)}
                                    className="text-xs font-semibold text-[#0078d4] hover:underline"
                                    disabled={empSaving}
                                  >
                                    Invite portal
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void onToggleEmployeeActive(e)}
                                  className="text-xs font-semibold text-[#605e5c] hover:text-[#323130] hover:underline"
                                  disabled={empSaving}
                                >
                                  {e.isActive === false
                                    ? 'Reactivate'
                                    : 'Deactivate'}
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {empInviteResult ? (
                      <div className="mt-3 rounded-lg border border-[#107c10]/30 bg-[#dff6dd] px-3 py-2 text-sm text-[#0b5a0b]">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <KeyRound className="h-4 w-4" />
                          Employee portal invite — copy password once
                        </p>
                        <p className="mt-1 text-xs">
                          {empInviteResult.email}
                          {empInviteResult.notificationQueued
                            ? ' · email queued'
                            : ' · email not queued (copy password)'}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 rounded bg-white/80 px-2 py-1 font-mono text-xs">
                            {empInviteResult.temporaryPassword}
                          </code>
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  empInviteResult.temporaryPassword,
                                );
                                setEmpInviteCopied(true);
                                setTimeout(
                                  () => setEmpInviteCopied(false),
                                  1500,
                                );
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            <Copy className="mr-1 inline h-3.5 w-3.5" />
                            {empInviteCopied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                        Portal users ({portalUsers.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setInviteOpen(true);
                          setInviteError(null);
                          setInviteResult(null);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Invite
                      </button>
                    </div>
                    {portalLoading ? (
                      <p className="mt-2 text-xs text-[#605e5c]">Loading…</p>
                    ) : portalUsers.length === 0 ? (
                      <p className="mt-2 text-xs text-[#605e5c]">
                        No portal logins yet — invite a host/admin for this
                        customer.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {portalUsers.map((u) => (
                          <li
                            key={u.id}
                            className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm"
                          >
                            <p className="font-semibold text-[#323130]">
                              {u.fullName}
                            </p>
                            <p className="text-xs text-[#605e5c]">{u.email}</p>
                            <p className="mt-0.5 text-[11px] text-[#8a8886]">
                              {u.isActive ? 'Active' : 'Suspended'}
                              {u.roles?.length
                                ? ` · ${u.roles.join(', ')}`
                                : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {inviteResult ? (
                      <div className="mt-3 rounded-lg border border-[#107c10]/30 bg-[#dff6dd] px-3 py-2 text-sm text-[#0b5a0b]">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <KeyRound className="h-4 w-4" />
                          Invite created — copy password once
                        </p>
                        <p className="mt-1 text-xs">
                          {inviteResult.email}
                          {inviteResult.notificationQueued
                            ? ' · email queued'
                            : ' · email not queued (copy password)'}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 rounded bg-white/80 px-2 py-1 font-mono text-xs">
                            {inviteResult.temporaryPassword}
                          </code>
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  inviteResult.temporaryPassword,
                                );
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1500);
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            <Copy className="mr-1 inline h-3.5 w-3.5" />
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                      Documents ({customerDocs.length})
                    </h3>
                    <p className="mt-1 text-[11px] text-[#8a8886]">
                      Shared with the customer portal (pdf / png / jpeg / webp ·
                      max 10MB). Requires documents.manage.
                    </p>
                    {docsLoading ? (
                      <p className="mt-2 text-xs text-[#605e5c]">Loading…</p>
                    ) : customerDocs.length === 0 ? (
                      <p className="mt-2 text-xs text-[#605e5c]">
                        No attachments yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {customerDocs.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#323130]">
                                {d.fileName}
                              </p>
                              <p className="text-[11px] text-[#8a8886]">
                                {(d.sizeBytes / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void onDownloadCustomerDoc(d)}
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Open
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form
                      onSubmit={onUploadCustomerDoc}
                      className="mt-3 space-y-2"
                    >
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                        onChange={(e) =>
                          setDocsFile(e.target.files?.[0] ?? null)
                        }
                        className="block w-full text-xs text-[#605e5c]"
                      />
                      <button
                        type="submit"
                        disabled={docsUploading || !docsFile}
                        className={btnSecondary}
                      >
                        <FileText className="mr-1 inline h-3.5 w-3.5" />
                        {docsUploading ? 'Uploading…' : 'Upload file'}
                      </button>
                    </form>
                    {docsError ? (
                      <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        {docsError}
                      </p>
                    ) : null}
                  </div>

                  <CustomerOverviewPanel
                    overview={overview}
                    loading={overviewLoading}
                    error={overviewError}
                  />

                  <CustomerReportPanel customerId={detail.id} />

                  {editError ? (
                    <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {editError}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {!editMode && !detailLoading ? (
              <div className="flex flex-wrap gap-2 border-t border-[#edebe9] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className={btnPrimary}
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInviteOpen(true);
                    setInviteError(null);
                  }}
                  className={btnSecondary}
                >
                  <UserPlus className="mr-1 inline h-4 w-4" />
                  Invite portal
                </button>
                <button
                  type="button"
                  onClick={() => void toggleActive()}
                  disabled={saving}
                  className={btnSecondary}
                >
                  {detail.status === 'SUSPENDED' || !detail.isActive ? (
                    <>
                      <UserCheck className="mr-1 inline h-4 w-4" />
                      Activate
                    </>
                  ) : (
                    <>
                      <UserX className="mr-1 inline h-4 w-4" />
                      Suspend
                    </>
                  )}
                </button>
                <Link
                  href={`/superadmin/contracts?customerId=${detail.id}`}
                  className={btnSecondary}
                >
                  Contract
                </Link>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {empEdit && detail ? (
        <Modal
          title="Edit employee"
          description={`${empEdit.employeeNumber ?? empEdit.fullName} · ${detail.name}`}
          onClose={() => setEmpEdit(null)}
          size="md"
        >
          <form onSubmit={onUpdateEmployee} className="space-y-3">
            <label className="block text-sm font-medium text-[#323130]">
              Full name
              <input
                required
                value={empEditForm.fullName}
                onChange={(e) =>
                  setEmpEditForm((f) => ({ ...f, fullName: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Employee number
                <input
                  value={empEditForm.employeeNumber}
                  onChange={(e) =>
                    setEmpEditForm((f) => ({
                      ...f,
                      employeeNumber: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Department
                <input
                  value={empEditForm.department}
                  onChange={(e) =>
                    setEmpEditForm((f) => ({
                      ...f,
                      department: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-[#323130]">
              Email
              <input
                type="email"
                value={empEditForm.email}
                onChange={(e) =>
                  setEmpEditForm((f) => ({ ...f, email: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Phone
              <input
                value={empEditForm.phone}
                onChange={(e) =>
                  setEmpEditForm((f) => ({ ...f, phone: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Access level
              <select
                value={empEditForm.accessLevel}
                onChange={(e) =>
                  setEmpEditForm((f) => ({
                    ...f,
                    accessLevel: e.target.value as
                      | 'STANDARD'
                      | 'RESTRICTED'
                      | 'ELEVATED',
                  }))
                }
                className={`mt-1 ${inputCls}`}
              >
                <option value="STANDARD">STANDARD</option>
                <option value="RESTRICTED">RESTRICTED</option>
                <option value="ELEVATED">ELEVATED</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Access card ref
                <input
                  value={empEditForm.accessCardRef}
                  onChange={(e) =>
                    setEmpEditForm((f) => ({
                      ...f,
                      accessCardRef: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                  placeholder="CARD-…"
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Biometric ref
                <input
                  value={empEditForm.biometricRef}
                  onChange={(e) =>
                    setEmpEditForm((f) => ({
                      ...f,
                      biometricRef: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                  placeholder="BIO-…"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#323130]">
              <input
                type="checkbox"
                checked={empEditForm.isActive}
                onChange={(e) =>
                  setEmpEditForm((f) => ({
                    ...f,
                    isActive: e.target.checked,
                  }))
                }
                className="rounded border-[#8a8886]"
              />
              Active
            </label>
            {empError ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {empError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setEmpEdit(null)}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={empSaving}>
                {empSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {empSitesFor && detail ? (
        <Modal
          title="Site grants"
          description={`${empSitesFor.fullName} · empty = all customer sites (Module 11-C)`}
          onClose={() => setEmpSitesFor(null)}
          size="md"
        >
          <form onSubmit={onSaveEmpSites} className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-[#323130]">
              <input
                type="checkbox"
                checked={empSitesUnrestricted}
                onChange={(e) => {
                  setEmpSitesUnrestricted(e.target.checked);
                  if (e.target.checked) setEmpSiteIds([]);
                }}
                className="rounded border-[#8a8886]"
              />
              Unrestricted (all active customer sites)
            </label>
            {!empSitesUnrestricted ? (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-[#edebe9] p-3">
                {(detail.sites ?? []).length === 0 ? (
                  <p className="text-sm text-[#605e5c]">No sites on this customer.</p>
                ) : (
                  (detail.sites ?? []).map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 text-sm text-[#323130]"
                    >
                      <input
                        type="checkbox"
                        checked={empSiteIds.includes(s.id)}
                        onChange={(e) => {
                          setEmpSiteIds((ids) =>
                            e.target.checked
                              ? [...ids, s.id]
                              : ids.filter((id) => id !== s.id),
                          );
                        }}
                        className="rounded border-[#8a8886]"
                      />
                      <span className="font-mono text-xs text-[#605e5c]">
                        {s.code}
                      </span>
                      <span>{s.name}</span>
                    </label>
                  ))
                )}
              </div>
            ) : null}
            {empError ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {empError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setEmpSitesFor(null)}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={empSaving}>
                {empSaving ? 'Saving…' : 'Save grants'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {contactCreateOpen && detail ? (
        <Modal
          title="Add contact"
          description={`${detail.name} · contacts directory`}
          onClose={() => setContactCreateOpen(false)}
          size="md"
        >
          <form onSubmit={onCreateContact} className="space-y-3">
            <label className="block text-sm font-medium text-[#323130]">
              Full name
              <input
                required
                value={contactForm.fullName}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, fullName: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Designation
                <input
                  value={contactForm.designation}
                  onChange={(e) =>
                    setContactForm((f) => ({
                      ...f,
                      designation: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Role
                <select
                  value={contactForm.role}
                  onChange={(e) =>
                    setContactForm((f) => ({
                      ...f,
                      role: e.target.value as CustomerContactRole,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                >
                  {CONTACT_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium text-[#323130]">
              Email
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, email: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Phone
                <input
                  value={contactForm.phone}
                  onChange={(e) =>
                    setContactForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Alt phone
                <input
                  value={contactForm.altPhone}
                  onChange={(e) =>
                    setContactForm((f) => ({ ...f, altPhone: e.target.value }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#323130]">
              <input
                type="checkbox"
                checked={contactForm.isPrimary}
                onChange={(e) =>
                  setContactForm((f) => ({
                    ...f,
                    isPrimary: e.target.checked,
                  }))
                }
              />
              Primary contact (syncs profile)
            </label>
            {contactError ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {contactError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setContactCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={contactSaving}
              >
                {contactSaving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {contactEdit && detail ? (
        <Modal
          title="Edit contact"
          description={contactEdit.fullName}
          onClose={() => setContactEdit(null)}
          size="md"
        >
          <form onSubmit={onUpdateContact} className="space-y-3">
            <label className="block text-sm font-medium text-[#323130]">
              Full name
              <input
                required
                value={contactEditForm.fullName}
                onChange={(e) =>
                  setContactEditForm((f) => ({
                    ...f,
                    fullName: e.target.value,
                  }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Designation
                <input
                  value={contactEditForm.designation}
                  onChange={(e) =>
                    setContactEditForm((f) => ({
                      ...f,
                      designation: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Role
                <select
                  value={contactEditForm.role}
                  onChange={(e) =>
                    setContactEditForm((f) => ({
                      ...f,
                      role: e.target.value as CustomerContactRole,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                >
                  {CONTACT_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium text-[#323130]">
              Email
              <input
                type="email"
                value={contactEditForm.email}
                onChange={(e) =>
                  setContactEditForm((f) => ({
                    ...f,
                    email: e.target.value,
                  }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Phone
                <input
                  value={contactEditForm.phone}
                  onChange={(e) =>
                    setContactEditForm((f) => ({
                      ...f,
                      phone: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Alt phone
                <input
                  value={contactEditForm.altPhone}
                  onChange={(e) =>
                    setContactEditForm((f) => ({
                      ...f,
                      altPhone: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#323130]">
              <input
                type="checkbox"
                checked={contactEditForm.isPrimary}
                onChange={(e) =>
                  setContactEditForm((f) => ({
                    ...f,
                    isPrimary: e.target.checked,
                  }))
                }
              />
              Primary contact (syncs profile)
            </label>
            <label className="flex items-center gap-2 text-sm text-[#323130]">
              <input
                type="checkbox"
                checked={contactEditForm.isActive}
                onChange={(e) =>
                  setContactEditForm((f) => ({
                    ...f,
                    isActive: e.target.checked,
                  }))
                }
              />
              Active
            </label>
            {contactError ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {contactError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setContactEdit(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={contactSaving}
              >
                {contactSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {empCreateOpen && detail ? (
        <Modal
          title="Add employee"
          description={`${detail.name} · customer access roster`}
          onClose={() => setEmpCreateOpen(false)}
          size="md"
        >
          <form onSubmit={onCreateEmployee} className="space-y-3">
            <label className="block text-sm font-medium text-[#323130]">
              Full name
              <input
                required
                value={empForm.fullName}
                onChange={(e) =>
                  setEmpForm((f) => ({ ...f, fullName: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Employee number
                <input
                  value={empForm.employeeNumber}
                  onChange={(e) =>
                    setEmpForm((f) => ({
                      ...f,
                      employeeNumber: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                  placeholder="EMP-…"
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Department
                <input
                  value={empForm.department}
                  onChange={(e) =>
                    setEmpForm((f) => ({ ...f, department: e.target.value }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-[#323130]">
              Email
              <input
                type="email"
                value={empForm.email}
                onChange={(e) =>
                  setEmpForm((f) => ({ ...f, email: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Phone
              <input
                value={empForm.phone}
                onChange={(e) =>
                  setEmpForm((f) => ({ ...f, phone: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Access level
              <select
                value={empForm.accessLevel}
                onChange={(e) =>
                  setEmpForm((f) => ({
                    ...f,
                    accessLevel: e.target.value as
                      | 'STANDARD'
                      | 'RESTRICTED'
                      | 'ELEVATED',
                  }))
                }
                className={`mt-1 ${inputCls}`}
              >
                <option value="STANDARD">STANDARD</option>
                <option value="RESTRICTED">RESTRICTED</option>
                <option value="ELEVATED">ELEVATED</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Access card ref
                <input
                  value={empForm.accessCardRef}
                  onChange={(e) =>
                    setEmpForm((f) => ({
                      ...f,
                      accessCardRef: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                  placeholder="CARD-…"
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Biometric ref
                <input
                  value={empForm.biometricRef}
                  onChange={(e) =>
                    setEmpForm((f) => ({
                      ...f,
                      biometricRef: e.target.value,
                    }))
                  }
                  className={`mt-1 ${inputCls}`}
                  placeholder="BIO-…"
                />
              </label>
            </div>
            {empError ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {empError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setEmpCreateOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={empSaving}>
                {empSaving ? 'Creating…' : 'Create employee'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {siteEdit && detail ? (
        <Modal
          title="Edit site"
          description={`${siteEdit.code} · ${detail.name}`}
          onClose={() => setSiteEdit(null)}
          size="md"
        >
          <form onSubmit={onUpdateSite} className="space-y-3">
            <label className="block text-sm font-medium text-[#323130]">
              Site name
              <input
                required
                value={siteEditForm.name}
                onChange={(e) =>
                  setSiteEditForm((f) => ({ ...f, name: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Address (optional)
              <textarea
                value={siteEditForm.address}
                onChange={(e) =>
                  setSiteEditForm((f) => ({ ...f, address: e.target.value }))
                }
                className={`mt-1 ${inputCls} min-h-[64px] resize-y`}
                rows={2}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[#323130]">
              <input
                type="checkbox"
                checked={siteEditForm.isActive}
                onChange={(e) =>
                  setSiteEditForm((f) => ({
                    ...f,
                    isActive: e.target.checked,
                  }))
                }
                className="rounded border-[#8a8886]"
              />
              Active
            </label>
            {siteError ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {siteError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setSiteEdit(null)}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={siteSaving}>
                {siteSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {siteCreateOpen && detail ? (
        <Modal
          title="Add site"
          description={`${detail.name} · linked to this customer`}
          onClose={() => setSiteCreateOpen(false)}
          size="md"
        >
          <form onSubmit={onCreateSite} className="space-y-3">
            <label className="block text-sm font-medium text-[#323130]">
              Branch
              <select
                required
                value={siteForm.branchId}
                onChange={(e) =>
                  setSiteForm((f) => ({ ...f, branchId: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              >
                <option value="" disabled>
                  Select branch…
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Site code
              <input
                required
                value={siteForm.code}
                onChange={(e) =>
                  setSiteForm((f) => ({ ...f, code: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
                placeholder="SITE-CUST-…"
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Site name
              <input
                required
                value={siteForm.name}
                onChange={(e) =>
                  setSiteForm((f) => ({ ...f, name: e.target.value }))
                }
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Address (optional)
              <textarea
                value={siteForm.address}
                onChange={(e) =>
                  setSiteForm((f) => ({ ...f, address: e.target.value }))
                }
                className={`mt-1 ${inputCls} min-h-[64px] resize-y`}
                rows={2}
              />
            </label>
            {siteError ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {siteError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setSiteCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={siteSaving || !siteForm.branchId}
              >
                {siteSaving ? 'Creating…' : 'Create site'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {inviteOpen && detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1b1a19]">
                  Invite portal user
                </h2>
                <p className="mt-1 text-sm text-[#605e5c]">
                  {detail.name} · CUSTOMER_PORTAL bound to this customer
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg p-1.5 text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onInvitePortal} className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-[#323130]">
                Full name
                <input
                  required
                  value={inviteForm.fullName}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Email
                <input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Phone (optional)
                <input
                  value={inviteForm.phone}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className={`mt-1 ${inputCls}`}
                />
              </label>
              {inviteError ? (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {inviteError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setInviteOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={inviteSaving}
                >
                  {inviteSaving ? 'Inviting…' : 'Create invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
