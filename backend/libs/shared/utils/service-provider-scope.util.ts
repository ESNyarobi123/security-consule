import { AuthUser } from '../types/auth-user';

/** Service-provider self-service: providers.self without staff visitors.manage. */
export function isServiceProviderSelfScoped(user: AuthUser): boolean {
  if (user.permissions.includes('visitors.manage')) return false;
  if (
    user.roles.includes('SUPER_ADMIN') ||
    user.roles.includes('GENERAL_MANAGER')
  ) {
    return false;
  }
  return (
    user.roles.includes('SERVICE_PROVIDER') ||
    user.permissions.includes('providers.self')
  );
}
