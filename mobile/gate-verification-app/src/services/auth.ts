import { apiRequest } from '@/services/api';
import {
  clearSession,
  setSession,
  type GateUser,
} from '@/services/auth-store';

type LoginResponse = {
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  };
  user: GateUser & {
    permissions: string[];
    allowedBranchIds: string[];
    allowedSiteIds: string[];
  };
};

const GATE_APP_ROLES = new Set(['GATE_OFFICER', 'SUPER_ADMIN']);

export async function login(
  email: string,
  password: string,
): Promise<GateUser> {
  const data = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });

  const roles = data.user.roles ?? [];
  const allowed = roles.some((r) => GATE_APP_ROLES.has(r));
  if (!allowed) {
    await clearSession();
    throw new Error('This app requires GATE_OFFICER role');
  }

  const user: GateUser = {
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
