import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * Portal 35.9 — customer employee login (not customer admin portal).
 * CUSTOMER_PORTAL admins keep full portal allowlist even if also linked.
 */
export function isCustomerEmployeeSelfScoped(user: AuthUser): boolean {
  if (!user.customerId) return false;
  if (user.roles.includes('CUSTOMER_PORTAL')) return false;
  if (user.roles.includes('SUPER_ADMIN')) return false;
  return user.roles.includes('CUSTOMER_EMPLOYEE');
}

/**
 * Entries/list self-scope: `access.self` without `access.manage`
 * (covers CUSTOMER_EMPLOYEE and any custom role granted only access.self).
 */
export function mustSelfScopeAccessEntries(user: AuthUser): boolean {
  if (user.roles.includes('SUPER_ADMIN')) return false;
  if (user.permissions.includes('access.manage')) return false;
  return user.permissions.includes('access.self');
}

/** Fail closed: CUSTOMER_EMPLOYEE JWT must carry customerId. */
export function assertCustomerEmployeeHasCustomerId(user: AuthUser): void {
  if (
    user.roles.includes('CUSTOMER_EMPLOYEE') &&
    !user.roles.includes('CUSTOMER_PORTAL') &&
    !user.customerId
  ) {
    throw new ForbiddenException({
      error: 'CUSTOMER_EMPLOYEE_SCOPE_REQUIRED',
      message: 'Customer employee accounts must be linked to a customer',
    });
  }
}
