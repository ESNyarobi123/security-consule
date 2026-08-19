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
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import { useSiteDuty } from '@/hooks/useSiteDuty';
import {
  acknowledgeAlert,
  escalateAlert,
  listFieldAlerts,
  type FieldAlert,
} from '@/services/alerts';
import { guardNameMap, listGuards } from '@/services/guards';

const ESCALATE_ROLES: Record<string, string[]> = {
  SUPERVISOR: [
    'SUPERVISOR',
    'FIELD_OFFICER',
    'BRANCH_MANAGER',
    'OPERATIONS_MANAGER',
    'SUPER_ADMIN',
  ],
  FIELD: [
    'FIELD_OFFICER',
    'BRANCH_MANAGER',
    'OPERATIONS_MANAGER',
    'SUPER_ADMIN',
  ],
  BOM: ['BRANCH_MANAGER', 'OPERATIONS_MANAGER', 'SUPER_ADMIN'],
};

function canEscalateStage(stage: string | undefined, roles: string[]): boolean {
  if (!stage || stage === 'CONTROL') return false;
  const allowed = ESCALATE_ROLES[stage];
  if (!allowed) return false;
  return roles.some((r) => allowed.includes(r));
}

export default function AlertsScreen() {
  const online = useOnline();
  const { user } = useAuth();
  const { site } = useSiteDuty();
  const [rows, setRows] = useState<FieldAlert[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site?.id) return;
    setBusy(true);
    setError(null);
    try {
      const [alerts, guards] = await Promise.all([
        listFieldAlerts(site.id),
        listGuards().catch(() => []),
      ]);
      const sorted = [...alerts].sort((a, b) => {
        if (a.acknowledged !== b.acknowledged) {
          return a.acknowledged ? 1 : -1;
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      setRows(sorted);
      setNames(guardNameMap(guards));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts');
    } finally {
      setBusy(false);
    }
  }, [site?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onAck(id: string) {
    if (!online) return;
    setActing(`ack-${id}`);
    setError(null);
    try {
      await acknowledgeAlert(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ack failed');
    } finally {
      setActing(null);
    }
  }

  async function onEscalate(id: string) {
    if (!online) return;
    setActing(`esc-${id}`);
    setError(null);
    try {
      await escalateAlert(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Escalate failed');
    } finally {
      setActing(null);
    }
  }

  return (
    <View style={styles.root}>
      {!online ? (
        <Text style={styles.warn}>Offline — Ack / Escalate disabled.</Text>
      ) : null}
      <Text style={styles.hint}>
        Escalate SUPERVISOR → FIELD → BOM → CONTROL. Guards cannot escalate.
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
            <Text style={styles.empty}>No field alerts for this site.</Text>
          }
          renderItem={({ item }) => {
            const high = item.severity?.toUpperCase() === 'HIGH';
            const guardLabel = item.guardId
              ? names[item.guardId] ?? item.guardId.slice(0, 8)
              : '—';
            const canEscalate =
              !item.acknowledged &&
              canEscalateStage(item.escalationStage, user?.roles ?? []);
            return (
              <View
                style={[
                  styles.row,
                  high && !item.acknowledged && styles.rowHigh,
                ]}
              >
                <Text style={[styles.sev, high && styles.sevHigh]}>
                  {item.severity}
                </Text>
                <Text style={styles.type}>{item.alertType}</Text>
                <Text style={styles.msg}>{item.message}</Text>
                <Text style={styles.meta}>
                  Guard {guardLabel}
                  {item.escalationStage ? ` · ${item.escalationStage}` : ''}
                  {item.acknowledged ? ' · acked' : ' · unacked'}
                </Text>
                <View style={styles.actions}>
                  {!item.acknowledged ? (
                    <Pressable
                      style={[
                        styles.btn,
                        (!online || acting === `ack-${item.id}`) &&
                          styles.disabled,
                      ]}
                      disabled={!online || acting === `ack-${item.id}`}
                      onPress={() => void onAck(item.id)}
                    >
                      <Text style={styles.btnText}>
                        {acting === `ack-${item.id}` ? '…' : 'Ack'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {canEscalate ? (
                    <Pressable
                      style={[
                        styles.btnGhost,
                        (!online || acting === `esc-${item.id}`) &&
                          styles.disabled,
                      ]}
                      disabled={!online || acting === `esc-${item.id}`}
                      onPress={() => void onEscalate(item.id)}
                    >
                      <Text style={styles.btnGhostText}>
                        {acting === `esc-${item.id}` ? '…' : 'Escalate'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
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
  rowHigh: { backgroundColor: '#ffebee', marginHorizontal: -8, paddingHorizontal: 8 },
  sev: {
    fontSize: 12,
    fontWeight: '700',
    color: '#556677',
    textTransform: 'uppercase',
  },
  sevHigh: { color: '#c62828', fontSize: 14, fontWeight: '900' },
  type: { fontWeight: '700', color: '#0f2744', fontSize: 15 },
  msg: { color: '#1a2b3c', fontSize: 14 },
  meta: { color: '#667788', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: {
    backgroundColor: '#0f2744',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnGhost: {
    borderWidth: 1,
    borderColor: '#0f2744',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnGhostText: { color: '#0f2744', fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.45 },
});
