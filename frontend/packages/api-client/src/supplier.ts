import { supplierAuthHeaders } from '@pssms/auth';
import type { LoginResult } from './index';
import type { SupplierSubmission } from './admin';

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
  vrn?: string | null;
  address?: string | null;
  category?: string;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountRef?: string | null;
  mobileMoneyProvider?: string | null;
  mobileMoneyRef?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  status: string;
  rejectedReason?: string | null;
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

export async function supplierLogin(email: string, password: string) {
  const res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<LoginResult>(res);
}

export async function registerSupplier(body: {
  companyName: string;
  contactName: string;
  email: string;
  password: string;
  phone?: string;
  tin?: string;
  vrn?: string;
  address?: string;
  category?: string;
}) {
  const res = await fetch(`${coreUrl()}/api/v1/procurement/suppliers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseEnvelope<{
    supplierId: string;
    code: string;
    name: string;
    status: string;
    email: string;
    message: string;
  }>(res);
}

export const getSupplierMe = (token?: string) =>
  supplierFetch<SupplierProfile>('/api/v1/procurement/suppliers/me', {
    token,
  });

export const updateSupplierMe = (
  body: Partial<{
    name: string;
    email: string;
    phone: string;
    tin: string;
    vrn: string;
    address: string;
    category: string;
    bankName: string;
    bankAccountName: string;
    bankAccountRef: string;
    mobileMoneyProvider: string;
    mobileMoneyRef: string;
    contactPerson: string;
    contactPhone: string;
    contactEmail: string;
  }>,
  token?: string,
) =>
  supplierFetch<SupplierProfile>('/api/v1/procurement/suppliers/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export const listSupplierOrders = (token?: string) =>
  supplierFetch<SupplierPurchaseOrder[]>(
    '/api/v1/procurement/purchase-orders',
    { token },
  );

export const listMySupplierSubmissions = (token?: string) =>
  supplierFetch<SupplierSubmission[]>(
    '/api/v1/procurement/suppliers/me/submissions',
    { token },
  );

export const createMySupplierSubmission = (
  body: {
    kind: string;
    title: string;
    description?: string;
    amount?: number;
    currency?: string;
    purchaseOrderId?: string;
  },
  token?: string,
) =>
  supplierFetch<SupplierSubmission>(
    '/api/v1/procurement/suppliers/me/submissions',
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );
