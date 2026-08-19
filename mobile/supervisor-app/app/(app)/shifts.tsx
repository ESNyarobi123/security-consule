import { useCallback, useMemo, useState } from 'react';
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
  confirmAssignment,
  listDeployments,
  listShifts,
  replaceAssignment,
  type Shift,
  type ShiftAssignment,
} from '@/services/operations';

type Row = {
  shift: Shift;
  assignment: ShiftAssignment;
};

export default function ShiftsScreen() {
  const online = useOnline();
  const { site } = useSiteDuty();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [replacements, setReplacements] = useState<string[]>([]);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site?.id) return;
    setBusy(true);
    setError(null);
    try {
      const [list, guards, deployments] = await Promise.all([
        listShifts(site.id),
        listGuards().catch(() => []),
        listDeployments().catch(() => []),
      ]);
      setShifts(list);
      setNames(guardNameMap(guards));
      setReplacements(
        deployments
          .filter((d) => d.siteId === site.id && d.status === 'ACTIVE')
          .map((d) => d.guardId),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shifts');
    } finally {
      setBusy(false);
    }
  }, [site?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const rows: Row[] = useMemo(
    () =>
      shifts.flatMap((shift) =>
        (shift.assignments ?? []).map((assignment) => ({ shift, assignment })),
      ),
    [shifts],
  );

  async function onConfirm(shiftId: string, assignmentId: string) {
    if (!online) return;
    setActing(`c-${assignmentId}`);
    setError(null);
    try {
      await confirmAssignment(shiftId, assignmentId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setActing(null);
    }
  }

  async function onReplace(
    shiftId: string,
    assignmentId: string,
    replacementGuardId: string,
  ) {
    if (!online) return;
    setActing(`r-${assignmentId}`);
    setError(null);
    try {
      await replaceAssignment(shiftId, assignmentId, replacementGuardId);
      setPickFor(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Replace failed');
    } finally {
      setActing(null);
    }
  }

  return (
    <View style={styles.root}>
      {!online ? (
        <Text style={styles.warn}>Offline — confirm / replace disabled.</Text>
      ) : null}
      <Text style={styles.hint}>
        Confirm the assigned guard is on post. Replace from other ACTIVE
        deployments at this site. Assigned guard cannot confirm or replace
        themselves.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy && rows.length === 0 ? (
        <ActivityIndicator color="#0f2744" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.assignment.id}
          refreshControl={
            <RefreshControl
              refreshing={busy}
              onRefresh={() => void load()}
              tintColor="#0f2744"
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No shift assignments at this site.</Text>
          }
          renderItem={({ item }) => {
            const a = item.assignment;
            const label =
              names[a.guardId] || a.employeeNumber || a.guardId.slice(0, 8);
            const active = a.status === 'ASSIGNED' || a.status === 'CONFIRMED';
            const others = replacements.filter((id) => id !== a.guardId);
            return (
              <View style={styles.row}>
                <Text style={styles.cat}>{item.shift.name}</Text>
                <Text style={styles.name}>{label}</Text>
                <Text style={styles.meta}>
                  {a.status} · {new Date(item.shift.startAt).toLocaleString()}
                </Text>
                {active ? (
                  <View style={styles.actions}>
                    {a.status === 'ASSIGNED' ? (
                      <Pressable
                        style={[
                          styles.btn,
                          (!online || acting === `c-${a.id}`) && styles.disabled,
                        ]}
                        disabled={!online || acting === `c-${a.id}`}
                        onPress={() => void onConfirm(item.shift.id, a.id)}
                      >
                        <Text style={styles.btnText}>
                          {acting === `c-${a.id}` ? '…' : 'Confirm'}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={[
                        styles.btnGhost,
                        (!online || acting === `r-${a.id}`) && styles.disabled,
                      ]}
                      disabled={!online || acting === `r-${a.id}`}
                      onPress={() =>
                        setPickFor(pickFor === a.id ? null : a.id)
                      }
                    >
                      <Text style={styles.btnGhostText}>Replace</Text>
                    </Pressable>
                  </View>
                ) : null}
                {pickFor === a.id
                  ? others.map((gid) => (
                      <Pressable
                        key={gid}
                        style={styles.pick}
                        onPress={() =>
                          void onReplace(item.shift.id, a.id, gid)
                        }
                      >
                        <Text style={styles.pickText}>
                          Use {names[gid] ?? gid.slice(0, 8)}
                        </Text>
                      </Pressable>
                    ))
                  : null}
                {pickFor === a.id && others.length === 0 ? (
                  <Text style={styles.meta}>
                    No other ACTIVE deployments at this site.
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
  pick: {
    marginTop: 6,
    backgroundColor: '#e8eef5',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pickText: { color: '#0f2744', fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
