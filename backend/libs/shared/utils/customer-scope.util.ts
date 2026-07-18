import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * Portal users (JWT customerId set) are force-scoped to their customer.
 * Staff may optionally filter by customerId query param.
 */
export function resolveCustomerScope(
  user: AuthUser,
  requestedCustomerId?: string,
): string | undefined {
  if (user.customerId) {
    if (requestedCustomerId && requestedCustomerId !== user.customerId) {
      throw new ForbiddenException({
        error: 'CUSTOMER_SCOPE_DENIED',
        message: 'Cannot access another customer',
      });
    }
    return user.customerId;
  }
  return requestedCustomerId;
}

export function requireCustomerScope(
  user: AuthUser,
  requestedCustomerId?: string,
): string {
  const id = resolveCustomerScope(user, requestedCustomerId);
  if (!id) {
    throw new ForbiddenException({
      error: 'CUSTOMER_ID_REQUIRED',
      message: 'customerId is required',
    });
  }
  return id;
}
