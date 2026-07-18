import { apiRequest } from '@/services/api';
import {
  clearSession,
  setSession,
  type GuardUser,
} from '@/services/auth-store';

type LoginResponse = {
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  };
  user: GuardUser & {
    permissions: string[];
    allowedBranchIds: string[];
    allowedSiteIds: string[];
  };
};

export async function login(
  email: string,
  password: string,
): Promise<GuardUser> {
  const data = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });

  const user: GuardUser = {
    id: data.user.id,
    email: data.user.email,
    fullName: data.user.fullName,
    organizationId: data.user.organizationId,
    roles: data.user.roles,
  };

  await setSession({
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
    user,
  });

  return user;
}

export async function logout(): Promise<void> {
  await clearSession();
}
