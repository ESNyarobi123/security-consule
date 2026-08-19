import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '@/services/api';

const DUTY_CACHE_KEY = 'pssms.guard.duty';

export type GuardDutySite = {
  id: string;
  code: string;
  name: string;
};

export type GuardDutyShift = {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  status: string;
  supervisorId?: string | null;
  supervisorName?: string | null;
};

export type GuardDuty = {
  guardId: string;
  employeeNumber: string;
  fullName?: string | null;
  site?: GuardDutySite | null;
  shift?: GuardDutyShift | null;
  deploymentId?: string | null;
  note: string;
};

export async function getCachedDuty(): Promise<GuardDuty | null> {
  const raw = await AsyncStorage.getItem(DUTY_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuardDuty;
  } catch {
    return null;
  }
}

export async function getMyDuty(forceRefresh = false): Promise<GuardDuty> {
  if (!forceRefresh) {
    const cached = await getCachedDuty();
    if (cached?.guardId) return cached;
  }

  try {
    const duty = await apiRequest<GuardDuty>('/attendance/me/duty');
    await AsyncStorage.setItem(DUTY_CACHE_KEY, JSON.stringify(duty));
    return duty;
  } catch (err) {
    const cached = await getCachedDuty();
    if (cached?.guardId) return cached;
    throw err;
  }
}
