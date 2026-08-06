import { AuthUser } from '../types/auth-user';

/** Consultant self-service: consultants.self without staff visitors.manage. */
export function isConsultantSelfScoped(user: AuthUser): boolean {
  if (user.permissions.includes('visitors.manage')) return false;
  if (
    user.roles.includes('SUPER_ADMIN') ||
    user.roles.includes('GENERAL_MANAGER')
  ) {
    return false;
  }
  return (
    user.roles.includes('CONSULTANT') ||
    user.permissions.includes('consultants.self')
  );
}
