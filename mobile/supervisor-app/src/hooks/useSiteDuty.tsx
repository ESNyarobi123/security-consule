import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getSelectedSiteId,
  listSites,
  setSelectedSiteId,
  type SiteSummary,
} from '@/services/sites';

type SiteDutyState = {
  ready: boolean;
  sites: SiteSummary[];
  site: SiteSummary | null;
  error: string | null;
  refresh: () => Promise<void>;
  selectSite: (id: string) => Promise<void>;
};

const SiteDutyContext = createContext<SiteDutyState | null>(null);

export function SiteDutyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [site, setSite] = useState<SiteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await listSites();
      setSites(list);
      const saved = await getSelectedSiteId();
      const next =
        list.find((s) => s.id === saved) ?? list[0] ?? null;
      setSite(next);
      if (next && next.id !== saved) {
        await setSelectedSiteId(next.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sites');
    }
  }, []);

  const selectSite = useCallback(async (id: string) => {
    const match = sites.find((s) => s.id === id);
    if (!match) return;
    setSite(match);
    await setSelectedSiteId(id);
  }, [sites]);

  useEffect(() => {
    void (async () => {
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const value = useMemo(
    () => ({ ready, sites, site, error, refresh, selectSite }),
    [ready, sites, site, error, refresh, selectSite],
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
