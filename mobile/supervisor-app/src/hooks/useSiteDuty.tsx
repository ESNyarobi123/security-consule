import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEMO_SITE_CODE } from '@/constants/config';
import { resolveSiteByCode, type SiteSummary } from '@/services/sites';

type SiteDutyState = {
  ready: boolean;
  site: SiteSummary | null;
  error: string | null;
  refresh: () => Promise<void>;
};

const SiteDutyContext = createContext<SiteDutyState | null>(null);

export function SiteDutyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [site, setSite] = useState<SiteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const resolved = await resolveSiteByCode(DEMO_SITE_CODE);
      setSite(resolved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load site');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const value = useMemo(
    () => ({ ready, site, error, refresh }),
    [ready, site, error, refresh],
  );

  return (
    <SiteDutyContext.Provider value={value}>{children}</SiteDutyContext.Provider>
  );
}

export function useSiteDuty(): SiteDutyState {
  const ctx = useContext(SiteDutyContext);
  if (!ctx) throw new Error('useSiteDuty must be used within SiteDutyProvider');
  return ctx;
}
