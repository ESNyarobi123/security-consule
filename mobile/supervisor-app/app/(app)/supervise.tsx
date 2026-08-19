import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSiteDuty } from '@/hooks/useSiteDuty';
import { guardNameMap, listGuards } from '@/services/guards';
import { listDeployments, type Deployment } from '@/services/operations';

export default function SuperviseScreen() {
  const { site } = useSiteDuty();
  const [rows, setRows] = useState<Deployment[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site?.id) return;
    setBusy(true);
    setError(null);
    try {
      const [deployments, guards] = await Promise.all([
        listDeployments(),
        listGuards().catch(() => []),
      ]);
      setRows(
        deployments.filter(
          (d) => d.siteId === site.id && d.status === 'ACTIVE',
        ),
      );
      setNames(guardNameMap(guards));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deployments');
    } finally {
      setBusy(false);
    }
  }, [site?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>
        ACTIVE deployments at the selected site. Guard roster names come from
        GET /guards (org-wide; site filter is the deployment list). Escalate
        alerts from Field alerts.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy && rows.length === 0 ? (
        <ActivityIndicator color="#0f2744" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={busy}
              onRefresh={() => void load()}
              tintColor="#0f2744"
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No ACTIVE deployments at this site.</Text>
          }
          renderItem={({ item }) => {
            const label = names[item.guardId] ?? item.guardId.slice(0, 8);
            return (
              <View style={styles.row}>
                <Text style={styles.name}>{label}</Text>
                <Text style={styles.meta}>
                  {item.status}
                  {item.contractNumber ? ` · ${item.contractNumber}` : ''}
                </Text>
                <Text style={styles.meta}>
                  From {new Date(item.startDate).toLocaleDateString()}
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
  error: { color: '#b3261e', marginBottom: 8 },
  empty: { color: '#667788', marginTop: 24, textAlign: 'center' },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: '#d9e2ec',
    paddingVertical: 12,
    gap: 4,
  },
  name: { fontWeight: '700', color: '#0f2744', fontSize: 16 },
  meta: { color: '#556677', fontSize: 13 },
});
