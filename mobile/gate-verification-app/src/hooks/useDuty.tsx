import AsyncStorage from '@react-native-async-storage/async-storage';
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
  DEMO_GATE_CODES,
  DEMO_SITE_CODE,
  GATE_SELECTION_KEY,
} from '@/constants/config';
import {
  listGatesForSite,
  resolveSiteByCode,
  type GateSummary,
  type SiteSummary,
} from '@/services/sites';

type DutyState = {
  ready: boolean;
  site: SiteSummary | null;
  gates: GateSummary[];
  selectedGate: GateSummary | null;
  error: string | null;
  selectGate: (gate: GateSummary) => Promise<void>;
  refresh: () => Promise<void>;
};

const DutyContext = createContext<DutyState | null>(null);

export function DutyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [site, setSite] = useState<SiteSummary | null>(null);
  const [gates, setGates] = useState<GateSummary[]>([]);
  const [selectedGate, setSelectedGate] = useState<GateSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const resolved = await resolveSiteByCode(DEMO_SITE_CODE);
      setSite(resolved);
      const all = await listGatesForSite(resolved.id);
      const preferred = DEMO_GATE_CODES.map((code) =>
        all.find((g) => g.code === code),
      ).filter((g): g is GateSummary => Boolean(g));
      const list = preferred.length > 0 ? preferred : all;
      setGates(list);

      const savedCode = await AsyncStorage.getItem(GATE_SELECTION_KEY);
      const match =
        (savedCode ? list.find((g) => g.code === savedCode) : null) ??
        list[0] ??
        null;
      setSelectedGate(match);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load site/gates');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const selectGate = useCallback(async (gate: GateSummary) => {
    setSelectedGate(gate);
    await AsyncStorage.setItem(GATE_SELECTION_KEY, gate.code);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      site,
      gates,
      selectedGate,
      error,
      selectGate,
      refresh,
    }),
    [ready, site, gates, selectedGate, error, selectGate, refresh],
  );

  return <DutyContext.Provider value={value}>{children}</DutyContext.Provider>;
}

export function useDuty(): DutyState {
  const ctx = useContext(DutyContext);
  if (!ctx) throw new Error('useDuty must be used within DutyProvider');
  return ctx;
}
