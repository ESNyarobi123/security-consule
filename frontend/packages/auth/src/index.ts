import { clearOidcRefresh } from './oidc-pkce';

export const TOKEN_COOKIE = 'pssms_admin_token';
export const USER_COOKIE = 'pssms_admin_user';
export const REFRESH_COOKIE = 'pssms_admin_refresh';

export const CUSTOMER_TOKEN_COOKIE = 'pssms_customer_token';
export const CUSTOMER_USER_COOKIE = 'pssms_customer_user';

export const SUPPLIER_TOKEN_COOKIE = 'pssms_supplier_token';
export const SUPPLIER_USER_COOKIE = 'pssms_supplier_user';

export const PARKING_TOKEN_COOKIE = 'pssms_parking_token';
export const PARKING_USER_COOKIE = 'pssms_parking_user';

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  customerId?: string | null;
  supplierId?: string | null;
};

export type AuthCookieNames = {
  tokenCookie: string;
  userCookie: string;
};

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

/** Factory for portal-isolated cookie sessions (admin vs customer, etc.). */
export function createAuthStore({
  tokenCookie,
  userCookie,
  refreshCookie,
}: AuthCookieNames & { refreshCookie?: string }) {
  return {
    tokenCookie,
    userCookie,
    refreshCookie,
    getToken(): string | null {
      return readCookie(tokenCookie);
    },
    getRefreshToken(): string | null {
      return refreshCookie ? readCookie(refreshCookie) : null;
    },
    getSessionUser(): SessionUser | null {
      const raw = readCookie(userCookie);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as SessionUser;
      } catch {
        return null;
      }
    },
    setSession(token: string, user: SessionUser, refreshToken?: string) {
      const maxAge = 60 * 60 * 24 * 7;
      writeCookie(tokenCookie, token, maxAge);
      writeCookie(userCookie, JSON.stringify(user), maxAge);
      if (refreshCookie && refreshToken) {
        writeCookie(refreshCookie, refreshToken, maxAge);
      }
    },
    setTokens(token: string, refreshToken?: string) {
      const maxAge = 60 * 60 * 24 * 7;
      writeCookie(tokenCookie, token, maxAge);
      if (refreshCookie && refreshToken) {
        writeCookie(refreshCookie, refreshToken, maxAge);
      }
    },
    clearSession() {
      clearCookie(tokenCookie);
      clearCookie(userCookie);
      if (refreshCookie) clearCookie(refreshCookie);
    },
  };
}

const adminAuth = createAuthStore({
  tokenCookie: TOKEN_COOKIE,
  userCookie: USER_COOKIE,
  refreshCookie: REFRESH_COOKIE,
});

const customerAuth = createAuthStore({
  tokenCookie: CUSTOMER_TOKEN_COOKIE,
  userCookie: CUSTOMER_USER_COOKIE,
});

const supplierAuth = createAuthStore({
  tokenCookie: SUPPLIER_TOKEN_COOKIE,
  userCookie: SUPPLIER_USER_COOKIE,
});

const parkingAuth = createAuthStore({
  tokenCookie: PARKING_TOKEN_COOKIE,
  userCookie: PARKING_USER_COOKIE,
});

export function getToken(): string | null {
  return adminAuth.getToken();
}

export function getRefreshToken(): string | null {
  return adminAuth.getRefreshToken();
}

export function getSessionUser(): SessionUser | null {
  return adminAuth.getSessionUser();
}

export function setSession(
  token: string,
  user: SessionUser,
  refreshToken?: string,
) {
  adminAuth.setSession(token, user, refreshToken);
}

export function setTokens(token: string, refreshToken?: string) {
  adminAuth.setTokens(token, refreshToken);
}

export function clearSession() {
  adminAuth.clearSession();
  if (typeof sessionStorage !== 'undefined') {
    try {
      clearOidcRefresh();
    } catch {
      /* ignore */
    }
  }
}

export function getCustomerToken(): string | null {
  return customerAuth.getToken();
}

export function getCustomerSessionUser(): SessionUser | null {
  return customerAuth.getSessionUser();
}

export function setCustomerSession(token: string, user: SessionUser) {
  customerAuth.setSession(token, user);
}

export function clearCustomerSession() {
  customerAuth.clearSession();
}

export function getSupplierToken(): string | null {
  return supplierAuth.getToken();
}

export function getSupplierSessionUser(): SessionUser | null {
  return supplierAuth.getSessionUser();
}

export function setSupplierSession(token: string, user: SessionUser) {
  supplierAuth.setSession(token, user);
}

export function clearSupplierSession() {
  supplierAuth.clearSession();
}

export function getParkingToken(): string | null {
  return parkingAuth.getToken();
}

export function getParkingSessionUser(): SessionUser | null {
  return parkingAuth.getSessionUser();
}

export function setParkingSession(token: string, user: SessionUser) {
  parkingAuth.setSession(token, user);
}

export function clearParkingSession() {
  parkingAuth.clearSession();
}

export function authHeaders(token?: string | null): HeadersInit {
  const t = token ?? getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function customerAuthHeaders(token?: string | null): HeadersInit {
  const t = token ?? getCustomerToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function supplierAuthHeaders(token?: string | null): HeadersInit {
  const t = token ?? getSupplierToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function parkingAuthHeaders(token?: string | null): HeadersInit {
  const t = token ?? getParkingToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export * from './oidc-pkce';
