import type { SessionUser } from '@pssms/auth';

export type NavItem = {
  href: string;
  label: string;
  permission: string;
  /**
   * Extra permissions that also grant this entry (OR). Used where one portal
   * serves two audiences — e.g. Payroll is the payroll console for
   * `payroll.manage` and "My payslips" for every signed-in employee.
   */
  alsoPermits?: string[];
  /**
   * Portal is open to any signed-in employee. Self-service payroll uses this:
   * the server still returns only the caller's own records, and no
   * administrator has to grant a permission before someone can see their own
   * payslips, leave balance or loan position.
   */
  authenticated?: boolean;
  group?: string;
};

export const ADMIN_PORTALS: NavItem[] = [
  { href: '/superadmin', label: 'Super Admin', permission: 'users.manage', group: 'Platform' },
  {
    href: '/administration',
    label: 'Administration',
    permission: 'enterprise.manage',
    group: 'Platform',
  },
  {
    href: '/superadmin/customers',
    label: 'Customers',
    permission: 'customers.manage',
    group: 'Service',
  },
  {
    href: '/superadmin/contracts',
    label: 'Contracts',
    permission: 'contracts.manage',
    group: 'Service',
  },
  { href: '/hr', label: 'HR & Employees', permission: 'hr.manage', group: 'People' },
  {
    href: '/payroll',
    label: 'Payroll',
    permission: 'payroll.manage',
    // Self-service payslips for every employee — no admin-granted ESS key.
    authenticated: true,
    group: 'People',
  },
  { href: '/payroll/cycles', label: 'Payroll cycles', permission: 'payroll.manage', group: 'People' },
  { href: '/loans', label: 'Loans', permission: 'loans.manage', group: 'People' },
  { href: '/finance', label: 'Finance', permission: 'finance.manage', group: 'Money' },
  { href: '/finance/invoices', label: 'Invoices', permission: 'finance.manage', group: 'Money' },
  { href: '/finance/petty-cash', label: 'Petty cash', permission: 'finance.manage', group: 'Money' },
  { href: '/finance/vouchers', label: 'Payment vouchers', permission: 'finance.manage', group: 'Money' },
  { href: '/finance/reports', label: 'Finance reports', permission: 'finance.manage', group: 'Money' },
  { href: '/procurement', label: 'Procurement', permission: 'procurement.manage', alsoPermits: ['inventory.manage'], group: 'Money' },
  { href: '/procurement/inventory', label: 'Inventory', permission: 'inventory.manage', group: 'Money' },
  { href: '/assets', label: 'Assets', permission: 'assets.manage', group: 'Money' },
  { href: '/assets/returns', label: 'Equipment returns', permission: 'assets.manage', group: 'Money' },
  { href: '/operations', label: 'Ops Console', permission: 'operations.manage', group: 'Field' },
  { href: '/operations/guards', label: 'Guards', permission: 'guards.manage', group: 'Field' },
  { href: '/cctv', label: 'CCTV', permission: 'cctv.manage', group: 'Field' },
  { href: '/cctv/alerts', label: 'CCTV alerts', permission: 'cctv.manage', group: 'Field' },
  { href: '/cctv/parking', label: 'CCTV parking', permission: 'cctv.manage', group: 'Field' },
  { href: '/cctv/access', label: 'CCTV access', permission: 'cctv.manage', group: 'Field' },
  { href: '/cctv/patrols', label: 'CCTV patrols', permission: 'cctv.manage', group: 'Field' },
  { href: '/cctv/alarms', label: 'CCTV alarms', permission: 'cctv.manage', group: 'Field' },
  { href: '/cctv/incidents', label: 'CCTV incidents', permission: 'cctv.manage', group: 'Field' },
  { href: '/devices', label: 'Devices', permission: 'operations.manage', group: 'Field' },
  { href: '/branch', label: 'Branch Ops', permission: 'operations.manage', group: 'Field' },
  { href: '/branch/sites', label: 'Sites', permission: 'operations.manage', group: 'Field' },
  {
    href: '/branch/access-points',
    label: 'Access points',
    permission: 'operations.manage',
    group: 'Field',
  },
  {
    href: '/branch/deployments',
    label: 'Deployments',
    permission: 'operations.manage',
    group: 'Field',
  },
  { href: '/branch/shifts', label: 'Shifts', permission: 'operations.manage', group: 'Field' },
  {
    href: '/branch/attendance',
    label: 'Attendance board',
    permission: 'operations.manage',
    group: 'Field',
  },
  { href: '/branch/alerts', label: 'Field alerts', permission: 'operations.manage', group: 'Field' },
  {
    href: '/branch/eob',
    label: 'Occurrence book',
    permission: 'operations.manage',
    group: 'Field',
  },
  {
    href: '/branch/patrols',
    label: 'Patrols',
    permission: 'operations.manage',
    group: 'Field',
  },
  {
    href: '/branch/incidents',
    label: 'Incidents',
    permission: 'incidents.manage',
    group: 'Field',
  },
  {
    href: '/branch/reports',
    label: 'Field reports',
    permission: 'operations.manage',
    group: 'Field',
  },
  {
    href: '/branch/staff',
    label: 'Branch staff',
    permission: 'operations.manage',
    group: 'Field',
  },
  {
    href: '/branch/inspections',
    label: 'Inspections',
    permission: 'operations.manage',
    group: 'Field',
  },
  {
    href: '/branch/parking',
    label: 'Branch parking',
    permission: 'operations.manage',
    group: 'Field',
  },
  {
    href: '/branch/petty-cash',
    label: 'Branch petty cash',
    permission: 'operations.manage',
    group: 'Field',
  },

  { href: '/compliance', label: 'Compliance', permission: 'audit.read', group: 'Governance' },
  {
    href: '/compliance/policies',
    label: 'Policies',
    permission: 'audit.read',
    group: 'Governance',
  },
  {
    href: '/compliance/consents',
    label: 'Consents',
    /** DPO mutates via dpo.manage; CO/auditor read via audit.read / compliance.manage */
    permission: 'audit.read',
    group: 'Governance',
  },
  {
    href: '/compliance/breaches',
    label: 'Breach register',
    /** DPO mutates via dpo.manage; CO/auditor read via audit.read / compliance.manage */
    permission: 'audit.read',
    group: 'Governance',
  },
  {
    href: '/compliance/risks',
    label: 'Risk register',
    permission: 'audit.read',
    group: 'Governance',
  },
  {
    href: '/compliance/access',
    label: 'Access review',
    permission: 'audit.read',
    group: 'Governance',
  },
  {
    href: '/compliance/incidents',
    label: 'Incident reports',
    permission: 'audit.read',
    group: 'Governance',
  },
  {
    href: '/compliance/legal',
    label: 'Legal / contracts',
    permission: 'audit.read',
    group: 'Governance',
  },
  { href: '/approvals', label: 'Approvals', permission: 'approvals.act', group: 'Governance' },
  {
    href: '/callcentre',
    label: 'Call Centre',
    permission: 'support.manage',
    alsoPermits: ['visitors.manage'],
    group: 'Service',
  },
  {
    href: '/callcentre/visitors',
    label: 'Visitor support',
    permission: 'visitors.manage',
    alsoPermits: ['support.manage'],
    group: 'Service',
  },
  {
    href: '/callcentre/complaints',
    label: 'Complaints',
    permission: 'support.manage',
    alsoPermits: ['visitors.manage'],
    group: 'Service',
  },
  {
    href: '/callcentre/tickets',
    label: 'Support tickets',
    permission: 'support.manage',
    alsoPermits: ['visitors.manage'],
    group: 'Service',
  },
  { href: '/marketing', label: 'Marketing', permission: 'marketing.manage', group: 'Service' },
  { href: '/marketing/pipeline', label: 'Pipeline', permission: 'marketing.manage', group: 'Service' },
  { href: '/marketing/campaigns', label: 'Campaigns', permission: 'marketing.manage', group: 'Service' },
  {
    href: '/marketing/commissions',
    label: 'Commissions',
    permission: 'marketing.manage',
    group: 'Service',
  },
  { href: '/developer', label: 'Developer', permission: 'integrations.manage', group: 'Platform' },
  {
    href: '/developer/connectivity',
    label: 'Connected systems',
    permission: 'integrations.manage',
    group: 'Platform',
  },
  { href: '/developer/apis', label: 'APIs', permission: 'integrations.manage', group: 'Platform' },
  { href: '/developer/health', label: 'Service health', permission: 'integrations.manage', group: 'Platform' },
  { href: '/developer/adapters', label: 'Adapters', permission: 'integrations.manage', group: 'Platform' },
  { href: '/developer/systems', label: 'Systems', permission: 'integrations.manage', group: 'Platform' },
  { href: '/developer/webhooks', label: 'Webhooks', permission: 'integrations.manage', group: 'Platform' },
  { href: '/developer/outbox', label: 'Outbox', permission: 'integrations.manage', group: 'Platform' },
  { href: '/developer/logs', label: 'Logs', permission: 'integrations.manage', group: 'Platform' },
  {
    href: '/developer/notifications',
    label: 'Delivery queue',
    permission: 'notifications.manage',
    alsoPermits: ['integrations.manage'],
    group: 'Platform',
  },
  { href: '/developer/config', label: 'Environments', permission: 'integrations.manage', group: 'Platform' },
  { href: '/developer/export', label: 'Export', permission: 'integrations.manage', group: 'Platform' },
  { href: '/developer/import', label: 'Import', permission: 'integrations.manage', group: 'Platform' },
  /** Bottom of sidebar — portal URLs, ports/subdomains, demo logins */
  {
    href: '/portal-directory',
    label: 'Portal directory',
    permission: 'users.manage',
    group: 'Guide',
  },
];

export const SUPERADMIN_LINKS: NavItem[] = [
  { href: '/superadmin', label: 'Overview', permission: 'users.manage' },
  { href: '/superadmin/users', label: 'Users', permission: 'users.manage' },
  { href: '/superadmin/roles', label: 'Roles', permission: 'users.manage' },
  { href: '/superadmin/portals', label: 'Portals', permission: 'users.manage' },
  { href: '/superadmin/organization', label: 'Organization', permission: 'users.manage' },
  { href: '/superadmin/modules', label: 'Modules', permission: 'users.manage' },
  {
    href: '/superadmin/approval-levels',
    label: 'Approval levels',
    permission: 'users.manage',
  },
  { href: '/superadmin/security', label: 'Security', permission: 'users.manage' },
  { href: '/superadmin/audit', label: 'Audit logs', permission: 'audit.read' },
  {
    href: '/superadmin/integrations',
    label: 'Integrations',
    permission: 'users.manage',
  },
  { href: '/superadmin/backups', label: 'Backups', permission: 'users.manage' },
  { href: '/superadmin/customers', label: 'Customers', permission: 'customers.manage' },
  { href: '/superadmin/contracts', label: 'Contracts', permission: 'contracts.manage' },
];

/** External customer portal navigation (cookie-isolated from admin). */
export const CUSTOMER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', permission: 'contracts.manage', group: 'Home' },
  { href: '/contracts', label: 'Contracts & SLA', permission: 'contracts.manage', group: 'Services' },
  { href: '/guards', label: 'Assigned guards', permission: 'contracts.manage', group: 'Services' },
  {
    href: '/attendance',
    label: 'Guard attendance',
    permission: 'contracts.manage',
    group: 'Services',
  },
  { href: '/access', label: 'Employee attendance', permission: 'access.manage', group: 'Site ops' },
  {
    href: '/my-access',
    label: 'My access',
    permission: 'access.self',
    group: 'Site ops',
  },
  { href: '/visitors', label: 'Visitors & gate logs', permission: 'visitors.manage', group: 'Site ops' },
  { href: '/parking', label: 'Parking', permission: 'parking.manage', group: 'Site ops' },
  {
    href: '/incidents',
    label: 'Incidents',
    permission: 'contracts.manage',
    group: 'Site ops',
  },
  { href: '/invoices', label: 'Invoices & payments', permission: 'finance.manage', group: 'Finance' },
  {
    href: '/payroll',
    label: 'Employee payroll',
    permission: 'finance.manage',
    group: 'Finance',
  },
  {
    href: '/my-payslips',
    label: 'My payslips',
    permission: 'access.self',
    group: 'Finance',
  },
  {
    href: '/requests',
    label: 'Service requests',
    permission: 'contracts.manage',
    group: 'Support',
  },
  {
    href: '/complaints',
    label: 'Complaints',
    permission: 'contracts.manage',
    group: 'Support',
  },
  { href: '/sla', label: 'SLA performance', permission: 'contracts.manage', group: 'Support' },
  {
    href: '/reports',
    label: 'Reports',
    permission: 'contracts.manage',
    group: 'Support',
  },
  { href: '/documents', label: 'Documents', permission: 'contracts.manage', group: 'Support' },
  {
    href: '/notifications',
    label: 'Alerts',
    permission: 'contracts.manage',
    group: 'Account',
  },
  {
    href: '/contacts',
    label: 'Contacts',
    permission: 'contracts.manage',
    group: 'Account',
  },
  { href: '/profile', label: 'Profile & users', permission: 'contracts.manage', group: 'Account' },
];

/** External supplier portal navigation (cookie-isolated from admin/customer). */
export const SUPPLIER_NAV: NavItem[] = [
  {
    href: '/orders',
    label: 'Purchase orders',
    permission: 'procurement.manage',
    group: 'Commerce',
  },
  {
    href: '/submissions',
    label: 'Quotes & invoices',
    permission: 'procurement.manage',
    group: 'Commerce',
  },
  {
    href: '/messages',
    label: 'Procurement',
    permission: 'procurement.manage',
    group: 'Commerce',
  },
  {
    href: '/profile',
    label: 'Company profile',
    permission: 'procurement.manage',
    group: 'Account',
  },
];

/** Parking ops portal navigation (cookie-isolated). */
export const PARKING_NAV: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    permission: 'parking.manage',
    group: 'Overview',
  },
  {
    href: '/reports',
    label: 'Reports',
    permission: 'parking.manage',
    group: 'Overview',
  },
  {
    href: '/vehicles',
    label: 'Vehicles',
    permission: 'parking.manage',
    group: 'Access',
  },
  {
    href: '/permits',
    label: 'Permits',
    permission: 'parking.manage',
    group: 'Access',
  },
  {
    href: '/spaces',
    label: 'Spaces',
    permission: 'parking.manage',
    group: 'Access',
  },
  {
    href: '/entries',
    label: 'Gate entries',
    permission: 'parking.manage',
    group: 'Access',
  },
  {
    href: '/patrols',
    label: 'Patrols',
    permission: 'parking.manage',
    group: 'Access',
  },
  {
    href: '/anpr',
    label: 'ANPR decide',
    permission: 'parking.manage',
    group: 'Access',
  },
  {
    href: '/violations',
    label: 'Violations',
    permission: 'parking.manage',
    group: 'Enforcement',
  },
  {
    href: '/blacklist',
    label: 'Blacklist',
    permission: 'parking.manage',
    group: 'Enforcement',
  },
];

export function customerNav(user?: SessionUser | null): NavItem[] {
  if (!user) return CUSTOMER_NAV;
  return CUSTOMER_NAV.filter((item) => can(user, item.permission));
}

/** Portal 35.9 employee (not customer admin). */
export function isCustomerEmployeeOnly(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.roles.includes('CUSTOMER_PORTAL')) return false;
  return user.roles.includes('CUSTOMER_EMPLOYEE');
}

export function customerDefaultPath(user: SessionUser | null): string {
  if (isCustomerEmployeeOnly(user)) return '/my-access';
  return '/dashboard';
}

export function supplierNav(): NavItem[] {
  return SUPPLIER_NAV;
}

export function parkingNav(): NavItem[] {
  return PARKING_NAV;
}

export function can(user: SessionUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.roles.includes('SUPER_ADMIN')) return true;
  return user.permissions.includes(permission);
}

/**
 * Mirrors backend `ORG_WIDE_SITE_VIEW_ROLES` (libs/shared/utils/site-scope.util.ts):
 * these roles ignore branch/site ACL rows, so they may create branch master data.
 */
export const ORG_WIDE_SITE_VIEW_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'CEO',
  'CMD',
  'OPERATIONS_MANAGER',
  'REGIONAL_MANAGER',
  'DEPARTMENT_HEAD',
  'CISO',
  'CONTROL_ROOM',
  'HR_OFFICER',
  'ACCOUNTS_OFFICER',
  'PAYROLL_OFFICER',
  'LEGAL',
  'MARKETING',
  'COMPLIANCE_OFFICER',
  'DPO',
  'INTERNAL_AUDITOR',
  'DEVELOPER',
  'IT_SUPPORT',
  'CALL_CENTRE',
  'CUSTOMER_SUPPORT',
  'CCTV_OPERATOR',
  'SECURITY_OFFICER',
  'PARKING_OFFICER',
]);

/** True when the caller can act on branch master data (branch ACL or org-wide). */
export function hasBranchScope(user: SessionUser | null): boolean {
  if (!user) return false;
  if ((user.allowedBranchIds?.length ?? 0) > 0) return true;
  return user.roles.some((r) => ORG_WIDE_SITE_VIEW_ROLES.has(r));
}

export function navItemAllowed(
  user: SessionUser | null,
  item: NavItem,
): boolean {
  if (item.authenticated) return user != null;
  if (can(user, item.permission)) return true;
  return (item.alsoPermits ?? []).some((code) => can(user, code));
}

export function navForUser(user: SessionUser | null): NavItem[] {
  return ADMIN_PORTALS.filter((item) => navItemAllowed(user, item));
}

export function defaultPortal(user: SessionUser | null): string {
  // Branch / field hierarchy lands on Portal 35.23, not the office
  // Administration page they only inherit through `enterprise.manage`.
  const branchOpsRoles = [
    'BRANCH_MANAGER',
    'FIELD_OFFICER',
    'REGIONAL_MANAGER',
    'TECHNICAL_MANAGER',
    'BD_MANAGER',
    'OPERATIONS_MANAGER',
    'SUPERVISOR',
  ];
  if (
    user?.roles.some((r) => branchOpsRoles.includes(r)) &&
    can(user, 'operations.manage')
  ) {
    return '/branch';
  }
  // Dedicated support officers should land on the support desk, not Payroll /
  // the ESS surface they inherit through `ess.access`.
  if (
    user?.roles.some((r) => ['CUSTOMER_SUPPORT', 'CALL_CENTRE'].includes(r)) &&
    (can(user, 'support.manage') || can(user, 'visitors.manage'))
  ) {
    return '/callcentre';
  }
  // Governance officers (Portal 35.21). Everyone signed in can open the
  // self-service Payroll/my-payslips surface, so without this they would land
  // on "No employee profile linked" instead of the governance desk.
  if (
    user?.roles.some((r) =>
      ['DPO', 'COMPLIANCE_OFFICER', 'LEGAL', 'INTERNAL_AUDITOR', 'CISO'].includes(r),
    ) &&
    can(user, 'audit.read')
  ) {
    return '/compliance';
  }
  // Money / delivery desks that also inherit Payroll through `authenticated`.
  if (user?.roles.includes('ACCOUNTS_OFFICER') && can(user, 'finance.manage')) {
    return '/finance';
  }
  if (user?.roles.includes('PAYROLL_OFFICER') && can(user, 'payroll.manage')) {
    return '/payroll/cycles';
  }
  if (user?.roles.includes('MARKETING') && can(user, 'marketing.manage')) {
    return '/marketing';
  }
  if (
    user?.roles.includes('PROCUREMENT_OFFICER') &&
    can(user, 'procurement.manage')
  ) {
    return '/procurement';
  }
  if (user?.roles.includes('STOREKEEPER') && can(user, 'inventory.manage')) {
    return '/procurement/inventory';
  }
  if (user?.roles.includes('DEVELOPER') && can(user, 'integrations.manage')) {
    return '/developer';
  }
  // Fallback: prefer a permission-gated portal over an `authenticated` one so
  // staffing roles never land on the self-service payslip page by accident.
  const nav = navForUser(user);
  const gated = nav.find((item) => !item.authenticated);
  return gated?.href ?? nav[0]?.href ?? '/login';
}

export function permissionForPath(pathname: string): string | null {
  const exact = ADMIN_PORTALS.find((p) => p.href === pathname);
  if (exact) return exact.permission;
  // Longest-prefix match for nested portal routes (e.g. /operations/guards)
  const nested = [...ADMIN_PORTALS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`));
  if (nested) return nested.permission;
  if (pathname.startsWith('/superadmin/users')) return 'users.manage';
  if (pathname.startsWith('/superadmin/customers')) return 'customers.manage';
  if (pathname.startsWith('/superadmin/contracts')) return 'contracts.manage';
  if (pathname.startsWith('/superadmin')) return 'users.manage';
  return null;
}

/**
 * Client-side route gate that understands `alsoPermits` (e.g. Payroll is open
 * to `payroll.manage` OR `ess.access`). Returns true when no portal owns the
 * path — the API still enforces its own permissions.
 */
export function pathAllows(
  user: SessionUser | null,
  pathname: string,
): boolean {
  const candidates = ADMIN_PORTALS.filter(
    (p) => pathname === p.href || pathname.startsWith(`${p.href}/`),
  ).sort((a, b) => b.href.length - a.href.length);
  const item = candidates[0];
  if (item) return navItemAllowed(user, item);

  const required = permissionForPath(pathname);
  return !required || can(user, required);
}
