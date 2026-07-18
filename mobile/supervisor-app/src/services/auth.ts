import { apiRequest } from '@/services/api';
import {
  clearSession,
  setSession,
  type SupervisorUser,
} from '@/services/auth-store';

type LoginResponse = {
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  };
  user: SupervisorUser & {
    permissions: string[];
    allowedBranchIds: string[];
    allowedSiteIds: string[];
  };
};

const SUPERVISOR_APP_ROLES = new Set(['SUPERVISOR', 'SUPER_ADMIN']);

export async function login(
  email: string,
  password: string,
): Promise<SupervisorUser> {
  const data = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });

  const roles = data.user.roles ?? [];
  const allowed = roles.some((r) => SUPERVISOR_APP_ROLES.has(r));
  if (!allowed) {
    await clearSession();
    throw new Error('This app requires SUPERVISOR or SUPER_ADMIN role');
  }

  const user: SupervisorUser = {
    id: data.user.id,
    email: data.user.email,
    fullName: data.user.fullName,
    organizationId: data.user.organizationId,
    roles,
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
