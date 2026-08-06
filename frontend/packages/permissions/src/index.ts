import type { SessionUser } from '@pssms/auth';

export type NavItem = {
  href: string;
  label: string;
  permission: string;
  group?: string;
};

export const ADMIN_PORTALS: NavItem[] = [
  { href: '/superadmin', label: 'Administration', permission: 'customers.manage', group: 'Platform' },
  {
    href: '/superadmin/users',
    label: 'Users',
    permission: 'users.manage',
    group: 'Platform',
  },
  { href: '/hr', label: 'HR', permission: 'hr.manage', group: 'People' },
  { href: '/ess', label: 'My ESS', permission: 'ess.access', group: 'People' },
  { href: '/payroll', label: 'Payroll', permission: 'payroll.manage', group: 'People' },
  { href: '/loans', label: 'Loans', permission: 'loans.manage', group: 'People' },
  { href: '/finance', label: 'Finance', permission: 'finance.manage', group: 'Money' },
  { href: '/finance/petty-cash', label: 'Petty cash', permission: 'finance.manage', group: 'Money' },
  { href: '/procurement', label: 'Procurement', permission: 'procurement.manage', group: 'Money' },
  { href: '/assets', label: 'Assets', permission: 'assets.manage', group: 'Money' },
  { href: '/assets/returns', label: 'Equipment returns', permission: 'assets.manage', group: 'Money' },
  { href: '/operations', label: 'Ops Console', permission: 'operations.manage', group: 'Field' },
  { href: '/operations/guards', label: 'Guards', permission: 'guards.manage', group: 'Field' },
  { href: '/cctv', label: 'CCTV', permission: 'cctv.manage', group: 'Field' },
  { href: '/devices', label: 'Devices', permission: 'operations.manage', group: 'Field' },
  { href: '/branch', label: 'Branch Ops', permission: 'operations.manage', group: 'Field' },
  { href: '/branch/sites', label: 'Sites', permission: 'operations.manage', group: 'Field' },
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

  { href: '/compliance', label: 'Compliance', permission: 'audit.read', group: 'Governance' },
  {
    href: '/compliance/policies',
    label: 'Policies',
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
  { href: '/approvals', label: 'Approvals', permission: 'approvals.act', group: 'Governance' },
  { href: '/callcentre', label: 'Call Centre', permission: 'visitors.manage', group: 'Service' },
  { href: '/marketing', label: 'Marketing', permission: 'customers.manage', group: 'Service' },
  { href: '/developer', label: 'Developer', permission: 'integrations.manage', group: 'Platform' },
  /** Bottom of sidebar — portal URLs, ports/subdomains, demo logins */
  {
    href: '/portal-directory',
    label: 'Portal directory',
    permission: 'users.manage',
    group: 'Guide',
  },
];

export const SUPERADMIN_LINKS: NavItem[] = [
  { href: '/superadmin', label: 'Overview', permission: 'customers.manage' },
  { href: '/superadmin/users', label: 'Users', permission: 'users.manage' },
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
  { href: '/access', label: 'Staff access', permission: 'access.manage', group: 'Site ops' },
  {
    href: '/my-access',
    label: 'My access',
    permission: 'access.self',
    group: 'Site ops',
  },
  { href: '/visitors', label: 'Visitors', permission: 'visitors.manage', group: 'Site ops' },
  { href: '/parking', label: 'Parking', permission: 'parking.manage', group: 'Site ops' },
  {
    href: '/incidents',
    label: 'Incidents',
    permission: 'contracts.manage',
    group: 'Site ops',
  },
  { href: '/invoices', label: 'Invoices & payments', permission: 'finance.manage', group: 'Finance' },
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
    href: '/entries',
    label: 'Gate entries',
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

export function navForUser(user: SessionUser | null): NavItem[] {
  return ADMIN_PORTALS.filter((item) => can(user, item.permission));
}

export function defaultPortal(user: SessionUser | null): string {
  return navForUser(user)[0]?.href ?? '/login';
}

export function permissionForPath(pathname: string): string | null {
  const exact = ADMIN_PORTALS.find((p) => p.href === pathname);
  if (exact) return exact.permission;
  // Longest-prefix match for nested portal routes (e.g. /operations/guards)
  const nested = [...ADMIN_PORTALS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`));
  if (nested) return nested.permission;
  // Nested Super Admin routes not listed above (legacy fallback).
  if (pathname.startsWith('/superadmin/users')) return 'users.manage';
  if (pathname.startsWith('/superadmin')) return 'customers.manage';
  return null;
}
