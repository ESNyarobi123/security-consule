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
  approveAttendance,
  listAttendance,
  supervisorClockIn,
  type AttendanceRecord,
} from '@/services/attendance';
import { guardNameMap, listGuards } from '@/services/guards';
import { listDeployments, type Deployment } from '@/services/operations';

export default function AttendanceScreen() {
  const online = useOnline();
  const { site } = useSiteDuty();
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [deployed, setDeployed] = useState<Deployment[]>([]);
  const [openGuardIds, setOpenGuardIds] = useState<Set<string>>(new Set());
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
      const [attendance, pending, guards, deployments] = await Promise.all([
        listAttendance(site.id),
        listAttendance(site.id, false),
        listGuards().catch(() => []),
        listDeployments().catch(() => []),
      ]);
      setRows(pending);
      setNames(guardNameMap(guards));
      setDeployed(
        deployments.filter((d) => d.siteId === site.id && d.status === 'ACTIVE'),
      );
      setOpenGuardIds(
        new Set(attendance.filter((r) => !r.clockOutAt).map((r) => r.guardId)),
      );
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

  const clockable = deployed.filter((d) => !openGuardIds.has(d.guardId));

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

  async function onClockIn(guardId: string) {
    if (!online || !site?.id) return;
    setActing(`in-${guardId}`);
    setError(null);
    try {
      await supervisorClockIn({
        guardId,
        siteId: site.id,
        remarks: remarks.trim() || undefined,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clock-in failed');
    } finally {
      setActing(null);
    }
  }

  return (
    <View style={styles.root}>
      {!online ? (
        <Text style={styles.warn}>Offline — actions disabled.</Text>
      ) : null}
      <Text style={styles.hint}>
        Approve guard punches (you cannot approve your own). Clock-in when the
        guard device failed.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Optional clock-in remarks"
        value={remarks}
        onChangeText={setRemarks}
      />
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
          ListHeaderComponent={
            clockable.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Supervisor clock-in</Text>
                {clockable.map((d) => {
                  const label = names[d.guardId] ?? d.guardId.slice(0, 8);
                  return (
                    <View key={d.id} style={styles.miniRow}>
                      <Text style={styles.name}>{label}</Text>
                      <Pressable
                        style={[
                          styles.btn,
                          (!online || acting === `in-${d.guardId}`) &&
                            styles.disabled,
                        ]}
                        disabled={!online || acting === `in-${d.guardId}`}
                        onPress={() => void onClockIn(d.guardId)}
                      >
                        <Text style={styles.btnText}>
                          {acting === `in-${d.guardId}` ? '…' : 'Clock in'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null
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
  block: {
    borderBottomWidth: 1,
    borderBottomColor: '#d9e2ec',
    paddingBottom: 12,
    marginBottom: 8,
    gap: 8,
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667788',
    textTransform: 'uppercase',
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
