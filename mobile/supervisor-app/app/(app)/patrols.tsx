import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useOnline } from '@/hooks/useOnline';
import { useSiteDuty } from '@/hooks/useSiteDuty';
import { guardNameMap, listGuards } from '@/services/guards';
import {
  listPatrolRoutes,
  listPatrolScans,
  markRouteMissed,
  type PatrolRoute,
  type PatrolScan,
} from '@/services/patrols';

type Row =
  | { kind: 'route'; route: PatrolRoute }
  | { kind: 'scan'; scan: PatrolScan };

export default function PatrolsScreen() {
  const online = useOnline();
  const { site } = useSiteDuty();
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [scans, setScans] = useState<PatrolScan[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site?.id) return;
    setBusy(true);
    setError(null);
    try {
      const [r, s, guards] = await Promise.all([
        listPatrolRoutes(site.id),
        listPatrolScans(site.id),
        listGuards().catch(() => []),
      ]);
      setRoutes(r);
      setScans(s.slice(0, 30));
      setNames(guardNameMap(guards));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load patrols');
    } finally {
      setBusy(false);
    }
  }, [site?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onMissed(id: string) {
    if (!online) return;
    setActing(id);
    setError(null);
    try {
      await markRouteMissed(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mark missed failed');
    } finally {
      setActing(null);
    }
  }

  const rows: Row[] = [
    ...routes.map((route) => ({ kind: 'route' as const, route })),
    ...scans.map((scan) => ({ kind: 'scan' as const, scan })),
  ];

  return (
    <View style={styles.root}>
      {!online ? (
        <Text style={styles.warn}>Offline — mark missed disabled.</Text>
      ) : null}
      <Text style={styles.hint}>
        Today’s route coverage and SLA. Recent scans below. No map / QR on this
        app.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy && rows.length === 0 ? (
        <ActivityIndicator color="#0f2744" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) =>
            item.kind === 'route' ? `r-${item.route.id}` : `s-${item.scan.id}`
          }
          refreshControl={
            <RefreshControl
              refreshing={busy}
              onRefresh={() => void load()}
              tintColor="#0f2744"
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No patrol routes or scans.</Text>
          }
          renderItem={({ item }) => {
            if (item.kind === 'route') {
              const r = item.route;
              const late = r.slaStatus === 'LATE' || r.slaStatus === 'MISSED';
              return (
                <View style={styles.row}>
                  <Text style={styles.cat}>Route</Text>
                  <Text style={styles.name}>{r.name}</Text>
                  <Text style={[styles.meta, late && styles.hot]}>
                    {r.coverageStatus ?? '—'} · SLA {r.slaStatus ?? '—'} ·{' '}
                    {r.scannedToday ?? 0}/{r.checkpointCount ?? 0} today
                  </Text>
                  {late ? (
                    <Pressable
                      style={[
                        styles.btn,
                        (!online || acting === r.id) && styles.disabled,
                      ]}
                      disabled={!online || acting === r.id}
                      onPress={() => void onMissed(r.id)}
                    >
                      <Text style={styles.btnText}>
                        {acting === r.id ? '…' : 'Mark missed'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            }
            const s = item.scan;
            const label = names[s.guardId] ?? s.guardId.slice(0, 8);
            return (
              <View style={styles.row}>
                <Text style={styles.cat}>Scan</Text>
                <Text style={styles.name}>
                  {s.checkpointCode ?? s.checkpointName ?? 'Checkpoint'}
                </Text>
                <Text style={styles.meta}>
                  {label} · {new Date(s.scannedAt).toLocaleString()}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16 },
  hint: { color: '#667788', fontSize: 12, marginBottom: 8 },
  warn: { color: '#8a5a00', marginBottom: 8 },
  error: { color: '#b3261e', marginBottom: 8 },
  empty: { color: '#667788', marginTop: 24, textAlign: 'center' },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: '#d9e2ec',
    paddingVertical: 12,
    gap: 4,
  },
  cat: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667788',
    textTransform: 'uppercase',
  },
  name: { fontWeight: '700', color: '#0f2744', fontSize: 16 },
  meta: { color: '#556677', fontSize: 13 },
  hot: { color: '#c62828', fontWeight: '700' },
  btn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#0f2744',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.45 },
});
