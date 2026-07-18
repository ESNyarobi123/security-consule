import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { DEVICE_TIME_DISCLAIMER } from '@/constants/config';
import { useOnline } from '@/hooks/useOnline';
import { listOutbox } from '@/offline/outbox';
import type { FieldEventType, OutboxRow } from '@/offline/types';
import { syncOutboxNow } from '@/services/sync';

export default function OutboxScreen() {
  const online = useOnline();
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRows(await listOutbox());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function onSync() {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const result = await syncOutboxNow();
      const accepted = result.results.filter((r) => r.status === 'ACCEPTED').length;
      const dup = result.results.filter((r) => r.status === 'DUPLICATE').length;
      const rejected = result.results.filter((r) => r.status === 'REJECTED').length;
      setSummary(
        result.sent === 0
          ? 'Nothing to sync'
          : `Sent ${result.sent}: ${accepted} ACCEPTED, ${dup} DUPLICATE, ${rejected} REJECTED`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.disclaimer}>{DEVICE_TIME_DISCLAIMER}</Text>
      <View style={styles.toolbar}>
        <Text style={styles.count}>{rows.length} events</Text>
        <Pressable
          style={[styles.syncBtn, (!online || busy) && styles.disabled]}
          onPress={() => void onSync()}
          disabled={!online || busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.syncText}>Sync Now</Text>
          )}
        </Pressable>
      </View>
      {summary ? <Text style={styles.ok}>{summary}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!online ? (
        <Text style={styles.warn}>Offline — Sync Now disabled until network returns.</Text>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No outbox events yet. Queue clock-in, alertness, or patrol from Duty.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <View style={[styles.typeBadge, typeBadgeStyle(item.eventType)]}>
                <Text style={styles.typeBadgeText}>{item.eventType}</Text>
              </View>
              <Text style={[styles.status, statusColor(item.status)]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.id}>{item.clientEventId}</Text>
            <Text style={styles.meta}>
              deviceTime {item.deviceTime} (audit only)
            </Text>
            {item.serverId ? (
              <Text style={styles.meta}>serverId {item.serverId}</Text>
            ) : null}
            {item.serverMessage ? (
              <Text style={styles.meta}>{item.serverMessage}</Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

function typeBadgeStyle(type: FieldEventType) {
  switch (type) {
    case 'CLOCK_IN':
      return { backgroundColor: '#d6eaf8' };
    case 'CLOCK_OUT':
      return { backgroundColor: '#f5e6d3' };
    case 'ALERTNESS_CONFIRM':
      return { backgroundColor: '#e2f0d9' };
    case 'PATROL_SCAN':
      return { backgroundColor: '#efe2f7' };
    default:
      return { backgroundColor: '#e8eef4' };
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'ACCEPTED':
      return { color: '#1b6b3a' };
    case 'DUPLICATE':
      return { color: '#8a6d00' };
    case 'REJECTED':
      return { color: '#b3261e' };
    case 'SYNCING':
      return { color: '#0b57d0' };
    default:
      return { color: '#445566' };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 10 },
  disclaimer: {
    color: '#6a7a8a',
    fontSize: 12,
    lineHeight: 17,
    backgroundColor: '#e8eef4',
    padding: 10,
    borderRadius: 8,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: { fontWeight: '600', color: '#334455' },
  syncBtn: {
    backgroundColor: '#0f2744',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 110,
    alignItems: 'center',
  },
  syncText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
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
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontWeight: '800',
    fontSize: 11,
    color: '#0f2744',
    letterSpacing: 0.3,
  },
  status: { fontWeight: '700', fontSize: 12 },
  id: { fontSize: 11, color: '#556677', fontFamily: 'Courier' },
  meta: { fontSize: 12, color: '#667788' },
});
