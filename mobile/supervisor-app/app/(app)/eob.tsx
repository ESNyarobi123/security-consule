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
import { listEob, type EobEntry } from '@/services/eob';

export default function EobScreen() {
  const { site } = useSiteDuty();
  const [rows, setRows] = useState<EobEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site?.id) return;
    setBusy(true);
    setError(null);
    try {
      const entries = await listEob(site.id);
      const sorted = [...entries].sort((a, b) => {
        const ta = new Date(a.occurredAt || a.createdAt || 0).getTime();
        const tb = new Date(b.occurredAt || b.createdAt || 0).getTime();
        return tb - ta;
      });
      setRows(sorted.slice(0, 40));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load EOB');
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
      <Text style={styles.hint}>Read-only · last entries for site</Text>
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
            <Text style={styles.empty}>No occurrence book entries.</Text>
          }
          renderItem={({ item }) => {
            const when = item.occurredAt || item.createdAt;
            return (
              <View style={styles.row}>
                <Text style={styles.cat}>{item.category}</Text>
                <Text style={styles.desc}>{item.description}</Text>
                {when ? (
                  <Text style={styles.meta}>
                    {new Date(when).toLocaleString()}
                  </Text>
                ) : null}
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
  cat: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667788',
    textTransform: 'uppercase',
  },
  desc: { color: '#1a2b3c', fontSize: 14 },
  meta: { color: '#8899aa', fontSize: 12 },
});
