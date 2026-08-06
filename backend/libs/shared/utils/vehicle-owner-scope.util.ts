import { AuthUser } from '../types/auth-user';

/** Owner self-service: parking.self without staff parking.manage. */
export function isVehicleOwnerSelfScoped(user: AuthUser): boolean {
  if (user.permissions.includes('parking.manage')) return false;
  if (user.roles.includes('SUPER_ADMIN') || user.roles.includes('GENERAL_MANAGER')) {
    return false;
  }
  return (
    user.roles.includes('VEHICLE_OWNER') ||
    user.permissions.includes('parking.self')
  );
}
