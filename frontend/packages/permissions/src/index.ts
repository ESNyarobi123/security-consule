import type { SessionUser } from '@pssms/auth';

export type NavItem = {
  href: string;
  label: string;
  permission: string;
  group?: string;
};

export const ADMIN_PORTALS: NavItem[] = [
  { href: '/superadmin', label: 'Administration', permission: 'customers.manage', group: 'Platform' },
  { href: '/hr', label: 'HR', permission: 'hr.manage', group: 'People' },
  { href: '/payroll', label: 'Payroll', permission: 'payroll.manage', group: 'People' },
  { href: '/finance', label: 'Finance', permission: 'finance.manage', group: 'Money' },
  { href: '/procurement', label: 'Procurement', permission: 'procurement.manage', group: 'Money' },
  { href: '/operations', label: 'Ops Console', permission: 'operations.manage', group: 'Field' },
  { href: '/operations/guards', label: 'Guards', permission: 'operations.manage', group: 'Field' },
  { href: '/cctv', label: 'CCTV', permission: 'operations.manage', group: 'Field' },
  { href: '/branch', label: 'Branch Ops', permission: 'operations.manage', group: 'Field' },
  { href: '/compliance', label: 'Compliance', permission: 'audit.read', group: 'Governance' },
  { href: '/approvals', label: 'Approvals', permission: 'approvals.act', group: 'Governance' },
  { href: '/callcentre', label: 'Call Centre', permission: 'visitors.manage', group: 'Service' },
  { href: '/marketing', label: 'Marketing', permission: 'customers.manage', group: 'Service' },
  { href: '/developer', label: 'Developer', permission: 'users.manage', group: 'Platform' },
];

export const SUPERADMIN_LINKS: NavItem[] = [
  { href: '/superadmin', label: 'Overview', permission: 'customers.manage' },
  { href: '/superadmin/customers', label: 'Customers', permission: 'customers.manage' },
  { href: '/superadmin/contracts', label: 'Contracts', permission: 'contracts.manage' },
];

/** External customer portal navigation (cookie-isolated from admin). */
export const CUSTOMER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', permission: 'contracts.manage' },
  { href: '/contracts', label: 'Contracts', permission: 'contracts.manage' },
  { href: '/invoices', label: 'Invoices', permission: 'finance.manage' },
  { href: '/visitors', label: 'Visitors', permission: 'visitors.manage' },
  { href: '/access', label: 'Access', permission: 'access.manage' },
  { href: '/parking', label: 'Parking', permission: 'parking.manage' },
];

/** External supplier portal navigation (cookie-isolated from admin/customer). */
export const SUPPLIER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', permission: 'procurement.manage' },
  { href: '/profile', label: 'Profile', permission: 'procurement.manage' },
  { href: '/orders', label: 'Orders', permission: 'procurement.manage' },
];

/** Parking ops portal navigation (cookie-isolated). */
export const PARKING_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', permission: 'parking.manage' },
  { href: '/permits', label: 'Permits', permission: 'parking.manage' },
  { href: '/entries', label: 'Entries', permission: 'parking.manage' },
  { href: '/violations', label: 'Violations', permission: 'parking.manage' },
  { href: '/anpr', label: 'ANPR', permission: 'parking.manage' },
  { href: '/blacklist', label: 'Blacklist', permission: 'parking.manage' },
];

export function customerNav(): NavItem[] {
  return CUSTOMER_NAV;
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
  if (pathname.startsWith('/superadmin')) return 'customers.manage';
  return null;
}
