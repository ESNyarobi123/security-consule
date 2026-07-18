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
  approveAttendance,
  listAttendance,
  type AttendanceRecord,
} from '@/services/attendance';
import { guardNameMap, listGuards } from '@/services/guards';

export default function AttendanceScreen() {
  const online = useOnline();
  const { site } = useSiteDuty();
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site?.id) return;
    setBusy(true);
    setError(null);
    try {
      const [attendance, guards] = await Promise.all([
        listAttendance(site.id, false),
        listGuards().catch(() => []),
      ]);
      setRows(attendance);
      setNames(guardNameMap(guards));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance');
    } finally {
      setBusy(false);
    }
  }, [site?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onApprove(id: string) {
    if (!online) return;
    setActing(id);
    setError(null);
    try {
      await approveAttendance(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setActing(null);
    }
  }

  return (
    <View style={styles.root}>
      {!online ? (
        <Text style={styles.warn}>Offline — Approve disabled.</Text>
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
            <Text style={styles.empty}>
              No pending attendance approvals.
            </Text>
          }
          renderItem={({ item }) => {
            const label = names[item.guardId] ?? item.guardId.slice(0, 8);
            const clockIn = item.clockInAt
              ? new Date(item.clockInAt).toLocaleString()
              : '—';
            return (
              <View style={styles.row}>
                <Text style={styles.name}>{label}</Text>
                <Text style={styles.meta}>Clock-in {clockIn}</Text>
                <Text style={styles.meta}>
                  {item.clockOutAt ? 'Clocked out' : 'Still on duty'}
                  {' · '}
                  {item.syncStatus ?? '—'}
                </Text>
                <Pressable
                  style={[
                    styles.btn,
                    (!online || acting === item.id) && styles.disabled,
                  ]}
                  disabled={!online || acting === item.id}
                  onPress={() => void onApprove(item.id)}
                >
                  <Text style={styles.btnText}>
                    {acting === item.id ? '…' : 'Approve'}
                  </Text>
                </Pressable>
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
  warn: { color: '#8a5a00', marginBottom: 8 },
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
