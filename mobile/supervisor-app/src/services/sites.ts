import AsyncStorage from '@react-native-async-storage/async-storage';
import { SELECTED_SITE_KEY } from '@/constants/config';
import { apiRequest } from '@/services/api';

export type SiteSummary = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export async function listSites(): Promise<SiteSummary[]> {
  const rows = await apiRequest<SiteSummary[]>('/enterprise/sites');
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((s) => s.isActive !== false);
}

export async function getSelectedSiteId(): Promise<string | null> {
  return AsyncStorage.getItem(SELECTED_SITE_KEY);
}

export async function setSelectedSiteId(id: string): Promise<void> {
  await AsyncStorage.setItem(SELECTED_SITE_KEY, id);
}
