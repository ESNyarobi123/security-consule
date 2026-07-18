import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'pssms.supervisor.accessToken';
const REFRESH_TOKEN_KEY = 'pssms.supervisor.refreshToken';
const USER_JSON_KEY = 'pssms.supervisor.user';

export type SupervisorUser = {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  roles: string[];
};

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setSession(params: {
  accessToken: string;
  refreshToken: string;
  user: SupervisorUser;
}): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, params.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, params.refreshToken);
  await SecureStore.setItemAsync(USER_JSON_KEY, JSON.stringify(params.user));
}

export async function getStoredUser(): Promise<SupervisorUser | null> {
  const raw = await SecureStore.getItemAsync(USER_JSON_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SupervisorUser;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_JSON_KEY);
}
