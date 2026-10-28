import { clearOidcRefresh } from './oidc-pkce';

export const TOKEN_COOKIE = 'pssms_admin_token';
export const USER_COOKIE = 'pssms_admin_user';
export const REFRESH_COOKIE = 'pssms_admin_refresh';

export const CUSTOMER_TOKEN_COOKIE = 'pssms_customer_token';
export const CUSTOMER_USER_COOKIE = 'pssms_customer_user';
export const CUSTOMER_REFRESH_COOKIE = 'pssms_customer_refresh';

export const SUPPLIER_TOKEN_COOKIE = 'pssms_supplier_token';
export const SUPPLIER_USER_COOKIE = 'pssms_supplier_user';
export const SUPPLIER_REFRESH_COOKIE = 'pssms_supplier_refresh';

export const PARKING_TOKEN_COOKIE = 'pssms_parking_token';
export const PARKING_USER_COOKIE = 'pssms_parking_user';
export const PARKING_REFRESH_COOKIE = 'pssms_parking_refresh';

export const PARTNER_TOKEN_COOKIE = 'pssms_partner_token';
export const PARTNER_USER_COOKIE = 'pssms_partner_user';
export const PARTNER_REFRESH_COOKIE = 'pssms_partner_refresh';

export const OWNER_TOKEN_COOKIE = 'pssms_owner_token';
export const OWNER_USER_COOKIE = 'pssms_owner_user';
export const OWNER_REFRESH_COOKIE = 'pssms_owner_refresh';

export const CONTRACTOR_TOKEN_COOKIE = 'pssms_contractor_token';
export const CONTRACTOR_USER_COOKIE = 'pssms_contractor_user';
export const CONTRACTOR_REFRESH_COOKIE = 'pssms_contractor_refresh';

export const CONSULTANT_TOKEN_COOKIE = 'pssms_consultant_token';
export const CONSULTANT_USER_COOKIE = 'pssms_consultant_user';
export const CONSULTANT_REFRESH_COOKIE = 'pssms_consultant_refresh';

export const PROVIDER_TOKEN_COOKIE = 'pssms_provider_token';
export const PROVIDER_USER_COOKIE = 'pssms_provider_user';
export const PROVIDER_REFRESH_COOKIE = 'pssms_provider_refresh';

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  /** ABAC scope from the access token (Harden A7). Empty branch list = site-only scope. */
  allowedBranchIds?: string[];
  allowedSiteIds?: string[];
  customerId?: string | null;
  supplierId?: string | null;
  b2bPartnerId?: string | null;
  mustChangePassword?: boolean;
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
  refreshCookie: CUSTOMER_REFRESH_COOKIE,
});

const supplierAuth = createAuthStore({
  tokenCookie: SUPPLIER_TOKEN_COOKIE,
  userCookie: SUPPLIER_USER_COOKIE,
  refreshCookie: SUPPLIER_REFRESH_COOKIE,
});

const parkingAuth = createAuthStore({
  tokenCookie: PARKING_TOKEN_COOKIE,
  userCookie: PARKING_USER_COOKIE,
  refreshCookie: PARKING_REFRESH_COOKIE,
});

const partnerAuth = createAuthStore({
  tokenCookie: PARTNER_TOKEN_COOKIE,
  userCookie: PARTNER_USER_COOKIE,
  refreshCookie: PARTNER_REFRESH_COOKIE,
});

const ownerAuth = createAuthStore({
  tokenCookie: OWNER_TOKEN_COOKIE,
  userCookie: OWNER_USER_COOKIE,
  refreshCookie: OWNER_REFRESH_COOKIE,
});

const contractorAuth = createAuthStore({
  tokenCookie: CONTRACTOR_TOKEN_COOKIE,
  userCookie: CONTRACTOR_USER_COOKIE,
  refreshCookie: CONTRACTOR_REFRESH_COOKIE,
});

const consultantAuth = createAuthStore({
  tokenCookie: CONSULTANT_TOKEN_COOKIE,
  userCookie: CONSULTANT_USER_COOKIE,
  refreshCookie: CONSULTANT_REFRESH_COOKIE,
});

const providerAuth = createAuthStore({
  tokenCookie: PROVIDER_TOKEN_COOKIE,
  userCookie: PROVIDER_USER_COOKIE,
  refreshCookie: PROVIDER_REFRESH_COOKIE,
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

export function getCustomerRefreshToken(): string | null {
  return customerAuth.getRefreshToken();
}

export function getCustomerSessionUser(): SessionUser | null {
  return customerAuth.getSessionUser();
}

export function setCustomerSession(
  token: string,
  user: SessionUser,
  refreshToken?: string,
) {
  customerAuth.setSession(token, user, refreshToken);
}

export function setCustomerTokens(token: string, refreshToken?: string) {
  customerAuth.setTokens(token, refreshToken);
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

export function getSupplierRefreshToken(): string | null {
  return supplierAuth.getRefreshToken();
}

export function setSupplierSession(
  token: string,
  user: SessionUser,
  refreshToken?: string,
) {
  supplierAuth.setSession(token, user, refreshToken);
}

/** Rotate only the tokens (silent refresh) without touching the cached user. */
export function setSupplierTokens(token: string, refreshToken?: string) {
  supplierAuth.setTokens(token, refreshToken);
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

export function getParkingRefreshToken(): string | null {
  return parkingAuth.getRefreshToken();
}

export function setParkingSession(
  token: string,
  user: SessionUser,
  refreshToken?: string,
) {
  parkingAuth.setSession(token, user, refreshToken);
}

/** Rotate only the tokens (silent refresh) without touching the cached user. */
export function setParkingTokens(token: string, refreshToken?: string) {
  parkingAuth.setTokens(token, refreshToken);
}

export function clearParkingSession() {
  parkingAuth.clearSession();
}

export function getPartnerToken(): string | null {
  return partnerAuth.getToken();
}

export function getPartnerSessionUser(): SessionUser | null {
  return partnerAuth.getSessionUser();
}

export function setPartnerSession(
  token: string,
  user: SessionUser,
  refreshToken?: string,
) {
  partnerAuth.setSession(token, user, refreshToken);
}

export function getPartnerRefreshToken(): string | null {
  return partnerAuth.getRefreshToken();
}

/** Rotate only the tokens (silent refresh) without touching the cached user. */
export function setPartnerTokens(token: string, refreshToken?: string) {
  partnerAuth.setTokens(token, refreshToken);
}

export function clearPartnerSession() {
  partnerAuth.clearSession();
}

export function getOwnerToken(): string | null {
  return ownerAuth.getToken();
}

export function getOwnerSessionUser(): SessionUser | null {
  return ownerAuth.getSessionUser();
}

export function setOwnerSession(
  token: string,
  user: SessionUser,
  refreshToken?: string,
) {
  ownerAuth.setSession(token, user, refreshToken);
}

export function getOwnerRefreshToken(): string | null {
  return ownerAuth.getRefreshToken();
}

/** Rotate only the tokens (silent refresh) without touching the cached user. */
export function setOwnerTokens(token: string, refreshToken?: string) {
  ownerAuth.setTokens(token, refreshToken);
}

export function clearOwnerSession() {
  ownerAuth.clearSession();
}

export function getContractorToken(): string | null {
  return contractorAuth.getToken();
}

export function getContractorSessionUser(): SessionUser | null {
  return contractorAuth.getSessionUser();
}

export function setContractorSession(
  token: string,
  user: SessionUser,
  refreshToken?: string,
) {
  contractorAuth.setSession(token, user, refreshToken);
}

export function getContractorRefreshToken(): string | null {
  return contractorAuth.getRefreshToken();
}

/** Rotate only the tokens (silent refresh) without touching the cached user. */
export function setContractorTokens(token: string, refreshToken?: string) {
  contractorAuth.setTokens(token, refreshToken);
}

export function clearContractorSession() {
  contractorAuth.clearSession();
}

export function getConsultantToken(): string | null {
  return consultantAuth.getToken();
}

export function getConsultantSessionUser(): SessionUser | null {
  return consultantAuth.getSessionUser();
}

export function setConsultantSession(
  token: string,
  user: SessionUser,
  refreshToken?: string,
) {
  consultantAuth.setSession(token, user, refreshToken);
}

export function getConsultantRefreshToken(): string | null {
  return consultantAuth.getRefreshToken();
}

/** Rotate only the tokens (silent refresh) without touching the cached user. */
export function setConsultantTokens(token: string, refreshToken?: string) {
  consultantAuth.setTokens(token, refreshToken);
}

export function clearConsultantSession() {
  consultantAuth.clearSession();
}

export function getProviderToken(): string | null {
  return providerAuth.getToken();
}

export function getProviderSessionUser(): SessionUser | null {
  return providerAuth.getSessionUser();
}

export function setProviderSession(
  token: string,
  user: SessionUser,
  refreshToken?: string,
) {
  providerAuth.setSession(token, user, refreshToken);
}

export function getProviderRefreshToken(): string | null {
  return providerAuth.getRefreshToken();
}

/** Rotate only the tokens (silent refresh) without touching the cached user. */
export function setProviderTokens(token: string, refreshToken?: string) {
  providerAuth.setTokens(token, refreshToken);
}

export function clearProviderSession() {
  providerAuth.clearSession();
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

export function partnerAuthHeaders(token?: string | null): HeadersInit {
  const t = token ?? getPartnerToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function ownerAuthHeaders(token?: string | null): HeadersInit {
  const t = token ?? getOwnerToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function contractorAuthHeaders(token?: string | null): HeadersInit {
  const t = token ?? getContractorToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function consultantAuthHeaders(token?: string | null): HeadersInit {
  const t = token ?? getConsultantToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function providerAuthHeaders(token?: string | null): HeadersInit {
  const t = token ?? getProviderToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export * from './oidc-pkce';
