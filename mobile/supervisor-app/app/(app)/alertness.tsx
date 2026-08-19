import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useOnline } from '@/hooks/useOnline';
import { useSiteDuty } from '@/hooks/useSiteDuty';
import {
  listAlertnessHistory,
  listPendingAlertness,
  markAlertnessMissed,
  type AlertnessCheck,
} from '@/services/alertness';
import { guardNameMap, listGuards } from '@/services/guards';

export default function AlertnessScreen() {
  const online = useOnline();
  const { site } = useSiteDuty();
  const [pending, setPending] = useState<AlertnessCheck[]>([]);
  const [history, setHistory] = useState<AlertnessCheck[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site?.id) return;
    setBusy(true);
    setError(null);
    try {
      const [p, h, guards] = await Promise.all([
        listPendingAlertness(site.id),
        listAlertnessHistory(site.id),
        listGuards().catch(() => []),
      ]);
      setPending(p);
      setHistory(h);
      setNames(guardNameMap(guards));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alertness');
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
      await markAlertnessMissed(id, remarks.trim() || undefined);
      setRemarks('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mark missed failed');
    } finally {
      setActing(null);
    }
  }

  const rows = [
    ...pending.map((r) => ({ ...r, _kind: 'pending' as const })),
    ...history.map((r) => ({ ...r, _kind: 'history' as const })),
  ];

  return (
    <View style={styles.root}>
      {!online ? (
        <Text style={styles.warn}>Offline — mark missed disabled.</Text>
      ) : null}
      <Text style={styles.hint}>
        Monitor scheduled confirmations. Past-due can be marked missed with a
        supervisor note.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Optional remarks when marking missed"
        value={remarks}
        onChangeText={setRemarks}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy && rows.length === 0 ? (
        <ActivityIndicator color="#0f2744" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item._kind}-${item.id}`}
          refreshControl={
            <RefreshControl
              refreshing={busy}
              onRefresh={() => void load()}
              tintColor="#0f2744"
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No alertness checks for this site.</Text>
          }
          renderItem={({ item }) => {
            const label =
              names[item.guardId] ||
              item.employeeNumber ||
              item.guardId.slice(0, 8);
            const when = new Date(item.scheduledAt).toLocaleString();
            return (
              <View style={styles.row}>
                <Text style={styles.status}>
                  {item._kind === 'pending' ? 'SCHEDULED' : item.status}
                  {item.pastDue ? ' · PAST DUE' : ''}
                </Text>
                <Text style={styles.name}>{label}</Text>
                <Text style={styles.meta}>{when}</Text>
                {item._kind === 'pending' ? (
                  <Pressable
                    style={[
                      styles.btn,
                      (!online || acting === item.id) && styles.disabled,
                    ]}
                    disabled={!online || acting === item.id}
                    onPress={() => void onMissed(item.id)}
                  >
                    <Text style={styles.btnText}>
                      {acting === item.id ? '…' : 'Mark missed'}
                    </Text>
                  </Pressable>
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
  warn: { color: '#8a5a00', marginBottom: 8 },
  error: { color: '#b3261e', marginBottom: 8 },
  empty: { color: '#667788', marginTop: 24, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#c5d0dc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
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
  name: { fontWeight: '700', color: '#0f2744', fontSize: 16 },
  meta: { color: '#556677', fontSize: 13 },
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
