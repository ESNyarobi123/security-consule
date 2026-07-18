export interface AuthUser {
  id: string;
  email: string;
  organizationId: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  allowedBranchIds: string[];
  allowedSiteIds: string[];
  /** Set for CUSTOMER_PORTAL users — force-scopes data access */
  customerId?: string | null;
  /** Set for SUPPLIER_PORTAL users — force-scopes data access */
  supplierId?: string | null;
}
