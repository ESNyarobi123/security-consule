import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

export function requireB2bPartnerScope(user: AuthUser): string {
  if (!user.b2bPartnerId) {
    throw new ForbiddenException({
      error: 'B2B_PARTNER_REQUIRED',
      message: 'Other security company partner binding required',
    });
  }
  return user.b2bPartnerId;
}
