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

/** Portal 35.7 — Site Supervisor, Field Officer, BOM, Operations Manager. */
export const SUPERVISOR_APP_ROLES = new Set([
  'SUPERVISOR',
  'FIELD_OFFICER',
  'BRANCH_MANAGER',
  'OPERATIONS_MANAGER',
  'SUPER_ADMIN',
]);

export function isSupervisorAppUser(roles: string[] | undefined): boolean {
  return (roles ?? []).some((r) => SUPERVISOR_APP_ROLES.has(r));
}

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
  const allowed = isSupervisorAppUser(roles);
  if (!allowed) {
    await clearSession();
    throw new Error(
      'This app is for Site Supervisors, Field Officers, Branch Operations Managers, and Operations Managers',
    );
  }

  const user: SupervisorUser = {
    id: data.user.id,
    email: data.user.email,
    fullName: data.user.fullName,
    organizationId: data.user.organizationId,
    roles,
    allowedSiteIds: data.user.allowedSiteIds ?? [],
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
