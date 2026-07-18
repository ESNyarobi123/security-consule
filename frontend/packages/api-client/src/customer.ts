import { customerAuthHeaders } from '@pssms/auth';
import type { LoginResult } from './index';
import type {
  Contract,
  Invoice,
  VisitorAppointment,
} from './admin';

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4001';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

async function parseEnvelope<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

async function customerFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customerAuthHeaders(init?.token),
    ...init?.headers,
  };
  const res = await fetch(`${coreUrl()}${path}`, { ...init, headers });
  return parseEnvelope<T>(res);
}

export type CustomerProfile = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type AccessEmployee = {
  id: string;
  organizationId: string;
  customerId: string;
  employeeNumber?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  accessCardRef?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ParkingVehicle = {
  id: string;
  organizationId: string;
  customerId?: string | null;
  plateNumber: string;
  vehicleType: string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  ownerName?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ParkingPermit = {
  id: string;
  organizationId: string;
  vehicleId: string;
  siteId: string;
  permitNumber: string;
  permitType: string;
  status: string;
  validFrom: string;
  validUntil: string;
};

/** Customer portal login → core-api POST /auth/login */
export async function customerLogin(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

/** GET /customers/me */
export const getCustomerMe = (token?: string) =>
  customerFetch<CustomerProfile>('/api/v1/customers/me', { token });

/** GET /contracts (customer-scoped by JWT) */
export const listCustomerContracts = (token?: string) =>
  customerFetch<Contract[]>('/api/v1/contracts', { token });

/** GET /finance/invoices */
export const listCustomerInvoices = (token?: string) =>
  customerFetch<Invoice[]>('/api/v1/finance/invoices', { token });

/** GET /visitors/appointments */
export const listCustomerVisitors = (token?: string) =>
  customerFetch<VisitorAppointment[]>('/api/v1/visitors/appointments', {
    token,
  });

/** GET /access/employees */
export const listCustomerAccessEmployees = (token?: string) =>
  customerFetch<AccessEmployee[]>('/api/v1/access/employees', { token });

/** GET /parking/vehicles */
export const listCustomerParkingVehicles = (token?: string) =>
  customerFetch<ParkingVehicle[]>('/api/v1/parking/vehicles', { token });

/** GET /parking/permits */
export const listCustomerParkingPermits = (token?: string) =>
  customerFetch<ParkingPermit[]>('/api/v1/parking/permits', { token });
