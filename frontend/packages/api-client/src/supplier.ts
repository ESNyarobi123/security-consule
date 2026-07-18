import { supplierAuthHeaders } from '@pssms/auth';
import type { LoginResult } from './index';

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

async function supplierFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...supplierAuthHeaders(init?.token),
    ...init?.headers,
  };
  const res = await fetch(`${coreUrl()}${path}`, { ...init, headers });
  return parseEnvelope<T>(res);
}

export type SupplierProfile = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  tin?: string | null;
  address?: string | null;
  status: string;
  createdAt: string;
};

export type SupplierPurchaseOrderLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  receivedQty: number;
  stockItemId?: string | null;
};

export type SupplierPurchaseOrder = {
  id: string;
  organizationId: string;
  supplierId: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  expectedDelivery?: string | null;
  approvalInstanceId?: string | null;
  lines: SupplierPurchaseOrderLine[];
  createdAt: string;
};

/** Supplier portal login → core-api POST /auth/login */
export async function supplierLogin(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

/** GET /procurement/suppliers/me */
export const getSupplierMe = (token?: string) =>
  supplierFetch<SupplierProfile>('/api/v1/procurement/suppliers/me', {
    token,
  });

/** GET /procurement/purchase-orders (supplier-scoped by JWT) */
export const listSupplierOrders = (token?: string) =>
  supplierFetch<SupplierPurchaseOrder[]>(
    '/api/v1/procurement/purchase-orders',
    { token },
  );
