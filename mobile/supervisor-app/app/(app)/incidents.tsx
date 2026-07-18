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
import {
  listIncidents,
  updateStatus,
  type Incident,
} from '@/services/incidents';

export default function IncidentsScreen() {
  const online = useOnline();
  const { site } = useSiteDuty();
  const [rows, setRows] = useState<Incident[]>([]);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site?.id) return;
    setBusy(true);
    setError(null);
    try {
      const all = await listIncidents(site.id);
      setRows(
        all.filter(
          (i) => i.status === 'OPEN' || i.status === 'INVESTIGATING',
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load incidents');
    } finally {
      setBusy(false);
    }
  }, [site?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onInvestigate(id: string) {
    if (!online) return;
    setActing(id);
    setError(null);
    try {
      await updateStatus(id, 'INVESTIGATING');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status update failed');
    } finally {
      setActing(null);
    }
  }

  return (
    <View style={styles.root}>
      {!online ? (
        <Text style={styles.warn}>Offline — status bump disabled.</Text>
      ) : null}
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
            <Text style={styles.empty}>No open / investigating incidents.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.status}>{item.status}</Text>
              <Text style={styles.title}>{item.title}</Text>
              {item.incidentNumber ? (
                <Text style={styles.meta}>{item.incidentNumber}</Text>
              ) : null}
              {item.description ? (
                <Text style={styles.desc} numberOfLines={3}>
                  {item.description}
                </Text>
              ) : null}
              {item.status === 'OPEN' ? (
                <Pressable
                  style={[
                    styles.btn,
                    (!online || acting === item.id) && styles.disabled,
                  ]}
                  disabled={!online || acting === item.id}
                  onPress={() => void onInvestigate(item.id)}
                >
                  <Text style={styles.btnText}>
                    {acting === item.id ? '…' : 'Mark investigating'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16 },
  warn: { color: '#8a5a00', marginBottom: 8 },
  error: { color: '#b3261e', marginBottom: 8 },
  empty: { color: '#667788', marginTop: 24, textAlign: 'center' },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: '#d9e2ec',
    paddingVertical: 12,
    gap: 4,
  },
  status: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667788',
    textTransform: 'uppercase',
  },
  title: { fontWeight: '700', color: '#0f2744', fontSize: 16 },
  meta: { color: '#667788', fontSize: 12 },
  desc: { color: '#334455', fontSize: 14, marginTop: 2 },
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
