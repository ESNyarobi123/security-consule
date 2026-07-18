import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * Portal users (JWT supplierId set) are force-scoped to their supplier.
 * Staff may optionally filter by supplierId query param.
 */
export function resolveSupplierScope(
  user: AuthUser,
  requestedSupplierId?: string,
): string | undefined {
  if (user.supplierId) {
    if (requestedSupplierId && requestedSupplierId !== user.supplierId) {
      throw new ForbiddenException({
        error: 'SUPPLIER_SCOPE_DENIED',
        message: 'Cannot access another supplier',
      });
    }
    return user.supplierId;
  }
  return requestedSupplierId;
}

export function requireSupplierScope(
  user: AuthUser,
  requestedSupplierId?: string,
): string {
  const id = resolveSupplierScope(user, requestedSupplierId);
  if (!id) {
    throw new ForbiddenException({
      error: 'SUPPLIER_ID_REQUIRED',
      message: 'supplierId is required',
    });
  }
  return id;
}
