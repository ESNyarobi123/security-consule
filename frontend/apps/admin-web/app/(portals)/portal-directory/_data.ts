/**
 * Portal directory — canonical map of PSSMS portals, URLs, and demo logins.
 * Demo password for seeded accounts: ChangeMe123!
 * Production host: *.hisgc.co.tz · Local: localhost ports (Docker may remap).
 */

export const DEMO_PASSWORD = 'ChangeMe123!';

export type LoginDemo = {
  email: string;
  role: string;
  note?: string;
};

export type PortalEntry = {
  id: string;
  name: string;
  designRef: string;
  summary: string;
  howItWorks: string;
  /** Path after host (e.g. /login) */
  path: string;
  /** Local Next/API listen port */
  localPort?: number;
  /** Production subdomain host (no scheme) */
  prodHost?: string;
  /** Same app, alternate entry (owner/contractor/…) */
  altPaths?: { label: string; path: string }[];
  logins: LoginDemo[];
  kind: 'web' | 'api' | 'files' | 'mobile' | 'internal';
};

/** Standalone apps + API + files + mobile */
export const EXTERNAL_PORTALS: PortalEntry[] = [
  {
    id: 'admin',
    name: 'Admin / Security Console',
    designRef: 'Portal 35.1–35.23 (internal multi-portal)',
    summary:
      'Main internal console (HTTPS web.hisgc.co.tz): Super Admin, HR, ESS, Finance, Ops, Branch, CCTV, Compliance, Call Centre, Developer, and more — role-filtered sidebar. No separate subdomain per internal portal.',
    howItWorks:
      'Staff login with company email. Menus appear by RBAC permissions. Super Admin sees all. Nested routes stay in this same app (not separate microservices). Design portals 35.1/35.3–35.5/35.15–35.24 live here as routes.',
    path: '/login',
    localPort: 3000,
    prodHost: 'web.hisgc.co.tz',
    logins: [
      { email: 'admin@highlink.co.tz', role: 'SUPER_ADMIN', note: 'Full platform' },
      { email: 'gm@highlink.co.tz', role: 'GENERAL_MANAGER' },
      { email: 'it1@highlink.co.tz', role: 'IT_SUPPORT', note: 'Users / helpdesk' },
      { email: 'ops1@highlink.co.tz', role: 'OPERATIONS_MANAGER' },
      { email: 'bom1@highlink.co.tz', role: 'BRANCH_MANAGER' },
      { email: 'field1@highlink.co.tz', role: 'FIELD_OFFICER' },
      { email: 'supervisor1@highlink.co.tz', role: 'SUPERVISOR' },
      { email: 'hr1@highlink.co.tz', role: 'HR_OFFICER' },
      { email: 'accounts1@highlink.co.tz', role: 'ACCOUNTS_OFFICER' },
      { email: 'payroll1@highlink.co.tz', role: 'PAYROLL_OFFICER' },
      { email: 'procurement1@highlink.co.tz', role: 'PROCUREMENT_OFFICER' },
      { email: 'store1@highlink.co.tz', role: 'STOREKEEPER' },
      { email: 'cctv1@highlink.co.tz', role: 'CCTV_OPERATOR' },
      { email: 'control1@highlink.co.tz', role: 'CONTROL_ROOM' },
      { email: 'callcentre1@highlink.co.tz', role: 'CALL_CENTRE' },
      { email: 'compliance1@highlink.co.tz', role: 'COMPLIANCE_OFFICER' },
      { email: 'dpo1@highlink.co.tz', role: 'DPO' },
      { email: 'ciso1@highlink.co.tz', role: 'CISO' },
      { email: 'auditor1@highlink.co.tz', role: 'INTERNAL_AUDITOR' },
      { email: 'depthead1@highlink.co.tz', role: 'DEPARTMENT_HEAD' },
      { email: 'legal1@highlink.co.tz', role: 'LEGAL' },
      { email: 'ceo@highlink.co.tz', role: 'CEO' },
      { email: 'cmd@highlink.co.tz', role: 'CMD' },
      { email: 'marketing1@highlink.co.tz', role: 'MARKETING' },
      { email: 'dev1@highlink.co.tz', role: 'DEVELOPER' },
      { email: 'gate1@highlink.co.tz', role: 'GATE_OFFICER', note: 'Also gate mobile app' },
      { email: 'guard1@highlink.co.tz', role: 'GUARD', note: 'Limited admin; primarily mobile' },
    ],
    kind: 'web',
  },
  {
    id: 'executive',
    name: 'Executive Dashboard',
    designRef: 'Portal 35.2',
    summary: 'Company-wide KPIs for CMD / CEO / GM / Dept Heads — period filters and live drill-downs.',
    howItWorks:
      'Separate Next app. Login → KPI dashboard. Needs reporting.read. No admin sidebar; executive-focused views only.',
    path: '/login',
    localPort: 3001,
    prodHost: 'executive.hisgc.co.tz',
    logins: [
      { email: 'ceo@highlink.co.tz', role: 'CEO' },
      { email: 'cmd@highlink.co.tz', role: 'CMD' },
      { email: 'gm@highlink.co.tz', role: 'GENERAL_MANAGER' },
    ],
    kind: 'web',
  },
  {
    id: 'customer',
    name: 'Customer Portal',
    designRef: 'Portal 35.8 + 35.9 employee access',
    summary:
      'Customer org self-service: contracts, guards, attendance, visitors, parking, invoices, complaints, reports, documents.',
    howItWorks:
      'Customer admin (CUSTOMER_PORTAL) sees org-scoped data only. Customer employees (CUSTOMER_EMPLOYEE) mostly use My access. Cookie auth separate from admin.',
    path: '/login',
    localPort: 3002,
    prodHost: 'customer.hisgc.co.tz',
    logins: [
      {
        email: 'portal@demo-mfg.co.tz',
        role: 'CUSTOMER_PORTAL',
        note: 'Demo Manufacturing (CUST-DEMO)',
      },
      {
        email: 'jane.doe@demo-mfg.co.tz',
        role: 'CUSTOMER_EMPLOYEE',
        note: 'EMP-1001 — My access',
      },
    ],
    kind: 'web',
  },
  {
    id: 'supplier',
    name: 'Supplier Portal',
    designRef: 'Portal 35.17',
    summary: 'Vendors view own POs / delivery status — read-scoped to their supplier record.',
    howItWorks:
      'Supplier login binds supplierId. Cannot mutate staff procurement routes. Demo: uniforms supplier.',
    path: '/login',
    localPort: 3003,
    prodHost: 'supplier.hisgc.co.tz',
    logins: [
      { email: 'portal@uniforms.co.tz', role: 'SUPPLIER_PORTAL', note: 'Demo uniforms supplier' },
    ],
    kind: 'web',
  },
  {
    id: 'recruitment',
    name: 'Recruitment (public + B2B partner)',
    designRef: 'Portal 35.13 + 35.14',
    summary: 'Public job board / apply. Partner login for other security companies (B2B guard supply).',
    howItWorks:
      'Public pages need no login. Partner uses /partner/login → own GuardSupplyRequests. HR triages in admin /hr/b2b-requests.',
    path: '/',
    localPort: 3004,
    prodHost: 'recruitment.hisgc.co.tz',
    altPaths: [{ label: 'B2B partner login', path: '/partner/login' }],
    logins: [
      {
        email: 'partner@demo-security.co.tz',
        role: 'OTHER_SECURITY_COMPANY',
        note: 'Partner portal — OSC-DEMO',
      },
    ],
    kind: 'web',
  },
  {
    id: 'visitor',
    name: 'Visitor Appointment',
    designRef: 'Portal 35.10 + E4/E5/E6',
    summary:
      'Public book visit (reference only). Contractor / consultant / service-provider self-view of own appointments.',
    howItWorks:
      'Guest books → host approves in customer/admin → gate code delivered EMAIL/SMS/WhatsApp. Gate app verifies. External roles use /contractor|/consultant|/provider.',
    path: '/',
    localPort: 3005,
    prodHost: 'visitor.hisgc.co.tz',
    altPaths: [
      { label: 'Contractor', path: '/contractor/login' },
      { label: 'Consultant', path: '/consultant/login' },
      { label: 'Service provider', path: '/provider/login' },
    ],
    logins: [
      {
        email: 'contractor1@vendor.co.tz',
        role: 'CONTRACTOR',
        note: 'VIS-DEMO-001 / 005',
      },
      {
        email: 'consultant1@auditpartners.tz',
        role: 'CONSULTANT',
        note: 'VIS-DEMO-002 / 003',
      },
      {
        email: 'provider1@techcare.tz',
        role: 'SERVICE_PROVIDER',
        note: 'VIS-DEMO-008 / 009',
      },
    ],
    kind: 'web',
  },
  {
    id: 'parking',
    name: 'Parking Management',
    designRef: 'Portal 35.12 + E3 owner',
    summary:
      'Ops: vehicles, permits, ANPR, entries, violations, blacklist, RFID, permit billing. Owner: own vehicles/permits/entries.',
    howItWorks:
      'parking1 runs ops. owner1 uses /owner/login (separate cookies). Bill permit → DRAFT finance invoice when vehicle has customerId.',
    path: '/login',
    localPort: 3006,
    prodHost: 'parking.hisgc.co.tz',
    altPaths: [{ label: 'Vehicle owner', path: '/owner/login' }],
    logins: [
      { email: 'parking1@highlink.co.tz', role: 'PARKING_ADMIN', note: 'Ops console' },
      {
        email: 'owner1@highlink.co.tz',
        role: 'VEHICLE_OWNER',
        note: 'Plate T123ABC · RFID-DEMO-T123',
      },
    ],
    kind: 'web',
  },
  {
    id: 'api',
    name: 'Core API',
    designRef: 'core-api · /api/v1',
    summary: 'Nest modular monolith — all domain APIs. Swagger often at /docs on core-api.',
    howItWorks:
      'Portals and mobile call this API with Bearer JWT from /auth/login. Production TLS via Caddy → api.hisgc.co.tz.',
    path: '/api/v1/health',
    localPort: 4001,
    prodHost: 'api.hisgc.co.tz',
    logins: [],
    kind: 'api',
  },
  {
    id: 'files',
    name: 'Files (MinIO)',
    designRef: 'Documents / ID scans / EOB attachments',
    summary: 'Object storage for DocumentObject uploads (EOB, petty cash, visitor ID, customer docs).',
    howItWorks:
      'Apps upload via /api/v1/documents (presigned URLs). Browser uses public files host in production.',
    path: '/',
    localPort: 9010,
    prodHost: 'files.hisgc.co.tz',
    logins: [],
    kind: 'files',
  },
  {
    id: 'guard-mobile',
    name: 'Guard Mobile App',
    designRef: 'Portal 35.6 · Expo',
    summary: 'Clock in/out, alertness, patrols, incidents — offline-capable outbox.',
    howItWorks:
      'Expo app → EXPO_PUBLIC_API_BASE = core-api. Login as guard1. Not a public website URL.',
    path: '(Expo app)',
    logins: [{ email: 'guard1@highlink.co.tz', role: 'GUARD' }],
    kind: 'mobile',
  },
  {
    id: 'gate-mobile',
    name: 'Gate Verification App',
    designRef: 'Portal 35.11 · Expo',
    summary: 'Verify visitor OTP / codes; entry & exit punch; deny raises FieldAlert + host notify.',
    howItWorks: 'Online verify against POST /visitors/gate/verify and /gate/exit. Login as gate1.',
    path: '(Expo app)',
    logins: [{ email: 'gate1@highlink.co.tz', role: 'GATE_OFFICER' }],
    kind: 'mobile',
  },
  {
    id: 'supervisor-mobile',
    name: 'Supervisor Mobile App',
    designRef: 'Portal 35.7 · Expo',
    summary: 'Live board, attendance approve, field alerts, incidents, EOB helpers.',
    howItWorks: 'Login as supervisor1 / field1 / bom1 depending on stage. Uses same core-api.',
    path: '(Expo app)',
    logins: [
      { email: 'supervisor1@highlink.co.tz', role: 'SUPERVISOR' },
      { email: 'field1@highlink.co.tz', role: 'FIELD_OFFICER' },
    ],
    kind: 'mobile',
  },
];

/** Dashboards / modules inside admin-web (same host as Admin) */
export type InternalModule = {
  href: string;
  label: string;
  description: string;
  typicalLogins: string;
};

export const INTERNAL_MODULES: InternalModule[] = [
  {
    href: '/superadmin',
    label: 'Administration overview',
    description: 'Platform home, customers/contracts shortcuts, KPI tiles.',
    typicalLogins: 'admin@ · marketing1@ · gm@',
  },
  {
    href: '/superadmin/users',
    label: 'Users & IAM',
    description: 'Create users, roles, ACL sites, MFA reset, password policy, approve role/suspend.',
    typicalLogins: 'admin@ · it1@ · ciso1@',
  },
  {
    href: '/superadmin/customers',
    label: 'Customers 360',
    description: 'CRM profile, sites, employees, contacts, guards, portal invite, complaints/reports.',
    typicalLogins: 'admin@ · marketing1@ · accounts1@',
  },
  {
    href: '/superadmin/contracts',
    label: 'Contracts',
    description: 'Commercial contracts, multi-step approval, sites cover, docs.',
    typicalLogins: 'marketing1@ · legal1@ · ceo@ · cmd@',
  },
  {
    href: '/hr',
    label: 'HR',
    description: 'Employees, leave, training, discipline, transfer/exit.',
    typicalLogins: 'hr1@ · depthead1@',
  },
  {
    href: '/ess',
    label: 'Employee Self-Service',
    description: 'Own profile, leave, payslips, loans, petty cash, equipment, MFA security.',
    typicalLogins: 'Any staff with ess.access (e.g. supervisor1@)',
  },
  {
    href: '/payroll',
    label: 'Payroll',
    description: 'Company payroll cycles / snapshots (approval before pay).',
    typicalLogins: 'payroll1@',
  },
  {
    href: '/loans',
    label: 'Loans',
    description: 'Employee loans admin list/approve (ESS self-apply separate).',
    typicalLogins: 'hr1@ · gm@ (final)',
  },
  {
    href: '/finance',
    label: 'Finance / Invoices',
    description: 'Invoices send/pay/void, overdue scan; linked parking bills.',
    typicalLogins: 'accounts1@',
  },
  {
    href: '/finance/petty-cash',
    label: 'Petty cash',
    description: 'Approve/reimburse vouchers + MinIO receipts.',
    typicalLogins: 'accounts1@ · gm@',
  },
  {
    href: '/procurement',
    label: 'Procurement',
    description: 'Suppliers, POs, inventory bridge.',
    typicalLogins: 'procurement1@',
  },
  {
    href: '/assets',
    label: 'Assets',
    description: 'Register/assign equipment; returns confirmation SoD.',
    typicalLogins: 'store1@',
  },
  {
    href: '/operations',
    label: 'Ops console',
    description: 'Guard readiness overview / field ops entry.',
    typicalLogins: 'ops1@ · bom1@',
  },
  {
    href: '/operations/guards',
    label: 'Guards',
    description: 'Guard profiles, status (ABSENT…), readiness, medical/kit.',
    typicalLogins: 'ops1@ · bom1@ (guards.manage)',
  },
  {
    href: '/branch',
    label: 'Branch Ops',
    description: 'Sites, deployments, shifts, attendance, alertness, alerts, EOB, patrols, incidents.',
    typicalLogins: 'ops1@ · bom1@ · field1@ · supervisor1@',
  },
  {
    href: '/cctv',
    label: 'CCTV monitoring',
    description: 'Camera wall metadata/events (no Nest video stream).',
    typicalLogins: 'cctv1@ · control1@',
  },
  {
    href: '/devices',
    label: 'Devices',
    description: 'Gateways, biometric/RFID/CCTV device registry, events.',
    typicalLogins: 'ops1@ · control1@',
  },
  {
    href: '/compliance',
    label: 'Compliance / DPO',
    description: 'Policies + breach register (mutate split: CO vs DPO).',
    typicalLogins: 'compliance1@ · dpo1@ · ciso1@ · auditor1@',
  },
  {
    href: '/approvals',
    label: 'Approvals queue',
    description: 'Shared approvals engine inbox (contracts, leave, IAM, etc.).',
    typicalLogins: 'gm@ · ceo@ · roles with approvals.act',
  },
  {
    href: '/callcentre',
    label: 'Call Centre',
    description: 'Visitor inbox, service tickets, complaints, gate entries, ID docs.',
    typicalLogins: 'callcentre1@',
  },
  {
    href: '/marketing',
    label: 'Marketing',
    description: 'Customer directory / BD thin view.',
    typicalLogins: 'marketing1@',
  },
  {
    href: '/developer',
    label: 'Developer / Integration',
    description: 'Health, adapters, webhooks, outbox, notifications, devices summary.',
    typicalLogins: 'dev1@',
  },
  {
    href: '/portal-directory',
    label: 'Portal directory (this page)',
    description: 'URLs, subdomains, ports, and demo logins for every portal.',
    typicalLogins: 'users.manage (admin@ · it1@)',
  },
];

export function resolvePortalUrl(
  entry: PortalEntry,
  opts: { production: boolean; path?: string },
): string {
  const path = opts.path ?? entry.path;
  if (entry.kind === 'mobile') return path;
  if (opts.production && entry.prodHost) {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `https://${entry.prodHost}${p === '/' ? '' : p}`;
  }
  if (entry.localPort != null) {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `http://localhost:${entry.localPort}${p === '/' ? '' : p}`;
  }
  return path;
}
