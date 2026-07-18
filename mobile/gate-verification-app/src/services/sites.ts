import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEMO_SITE_CODE, SITE_CACHE_KEY } from '@/constants/config';
import { apiRequest } from '@/services/api';

export type SiteSummary = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export type GateSummary = {
  id: string;
  siteId: string;
  code: string;
  name: string;
  gateType: string;
  isActive: boolean;
};

export async function getCachedDemoSite(): Promise<SiteSummary | null> {
  const raw = await AsyncStorage.getItem(SITE_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SiteSummary;
  } catch {
    return null;
  }
}

/** Resolve site by code via GET /enterprise/sites */
export async function resolveSiteByCode(
  code: string = DEMO_SITE_CODE,
  forceRefresh = false,
): Promise<SiteSummary> {
  if (!forceRefresh) {
    const cached = await getCachedDemoSite();
    if (cached?.id && cached.code === code) return cached;
  }

  const sites = await apiRequest<SiteSummary[]>('/enterprise/sites');
  const site = sites.find((s) => s.code === code);
  if (!site) {
    throw new Error(`Site ${code} not found — run seed data`);
  }

  const summary: SiteSummary = {
    id: site.id,
    code: site.code,
    name: site.name,
    isActive: site.isActive,
  };
  await AsyncStorage.setItem(SITE_CACHE_KEY, JSON.stringify(summary));
  return summary;
}

/** Resolve gates via GET /enterprise/gates?siteId= */
export async function listGatesForSite(siteId: string): Promise<GateSummary[]> {
  const gates = await apiRequest<GateSummary[]>(
    `/enterprise/gates?siteId=${encodeURIComponent(siteId)}`,
  );
  return Array.isArray(gates) ? gates.filter((g) => g.isActive !== false) : [];
}
