import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const REQUIRED_ANY_PERMISSIONS_KEY = 'requiredAnyPermissions';

/** Require all listed permission codes (AND). SUPER_ADMIN bypasses via PermissionsGuard. */
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, codes);

/** Require at least one listed permission code (OR). SUPER_ADMIN bypasses via PermissionsGuard. */
export const RequireAnyPermissions = (...codes: string[]) =>
  SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, codes);
