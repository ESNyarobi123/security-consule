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
import {
  enqueueConfirmAlertness,
  fetchPendingAlertness,
  type PendingAlertnessCheck,
} from '@/services/alertness';

export default function AlertnessScreen() {
  const online = useOnline();
  const [checks, setChecks] = useState<PendingAlertnessCheck[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!online) {
      setError('Online required to load pending alertness checks.');
      return;
    }
    setError(null);
    const rows = await fetchPendingAlertness();
    setChecks(rows);
  }, [online]);

  useFocusEffect(
    useCallback(() => {
      void load().catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load pending');
      });
    }, [load]),
  );

  async function onRefresh() {
    if (!online) {
      setError('Pull to refresh needs network.');
      return;
    }
    setRefreshing(true);
    try {
      await load();
      setMessage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  async function onConfirm(check: PendingAlertnessCheck) {
    setBusyId(check.id);
    setError(null);
    setMessage(null);
    try {
      const row = await enqueueConfirmAlertness(check.id);
      setMessage(
        `Queued ALERTNESS_CONFIRM ${row.clientEventId.slice(0, 8)}… — sync from Outbox.`,
      );
      setChecks((prev) => prev.filter((c) => c.id !== check.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>
        Pending checks from GET /attendance/alertness/pending. Confirm queues
        ALERTNESS_CONFIRM with demo GPS — sync via Outbox.
      </Text>
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!online ? (
        <Text style={styles.warn}>Offline — cannot refresh pending list.</Text>
      ) : null}

      <FlatList
        data={checks}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            enabled={online}
          />
        }
        contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {online
              ? 'No pending alertness checks.'
              : 'Go online to load pending checks.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.ref}>
              {item.referenceNumber ?? item.id.slice(0, 8)}
            </Text>
            <Text style={styles.meta}>
              Scheduled {new Date(item.scheduledAt).toLocaleString()}
            </Text>
            <Text style={styles.meta}>Status {item.status}</Text>
            <Pressable
              style={[styles.btn, busyId === item.id && styles.disabled]}
              onPress={() => void onConfirm(item)}
              disabled={busyId !== null}
            >
              {busyId === item.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Confirm (queue)</Text>
              )}
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 10 },
  hint: {
    color: '#556677',
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: '#e8eef4',
    padding: 10,
    borderRadius: 8,
  },
  ok: { color: '#1b6b3a' },
  error: { color: '#b3261e' },
  warn: { color: '#8a6d00' },
  empty: { color: '#778899', marginTop: 24, textAlign: 'center' },
  row: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    gap: 6,
  },
  ref: { fontWeight: '700', color: '#0f2744', fontSize: 15 },
  meta: { fontSize: 12, color: '#667788' },
  btn: {
    marginTop: 4,
    backgroundColor: '#0f2744',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.7 },
});
