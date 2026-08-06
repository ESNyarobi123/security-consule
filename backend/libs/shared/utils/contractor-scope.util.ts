import { AuthUser } from '../types/auth-user';

/** Contractor self-service: visitors.self without staff visitors.manage. */
export function isContractorSelfScoped(user: AuthUser): boolean {
  if (user.permissions.includes('visitors.manage')) return false;
  if (
    user.roles.includes('SUPER_ADMIN') ||
    user.roles.includes('GENERAL_MANAGER')
  ) {
    return false;
  }
  return (
    user.roles.includes('CONTRACTOR') ||
    user.permissions.includes('visitors.self')
  );
}
