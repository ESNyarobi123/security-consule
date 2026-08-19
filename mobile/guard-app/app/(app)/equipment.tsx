import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useOnline } from '@/hooks/useOnline';
import {
  confirmMyEquipment,
  listMyEquipment,
  type EssEquipment,
} from '@/services/field';

export default function EquipmentScreen() {
  const online = useOnline();
  const [rows, setRows] = useState<EssEquipment[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!online) return;
    setError(null);
    setMissing(false);
    try {
      setRows(await listMyEquipment());
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      if (/ESS_PROFILE_MISSING/i.test(text) || /linked/i.test(text)) {
        setMissing(true);
        setRows([]);
      } else {
        setError(text);
      }
    }
  }, [online]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onConfirm(id: string) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await confirmMyEquipment(id);
      setMessage('Kit confirmed for this assignment.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.hint}>
        Confirm equipment issued to you for this duty. Returns still go through
        storekeeper confirmation — creator ≠ confirmer.
      </Text>
      {!online ? (
        <Text style={styles.hint}>Online required to load kit.</Text>
      ) : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {missing ? (
        <Text style={styles.error}>
          Ask HR to link your employee profile before kit confirm.
        </Text>
      ) : null}
      {rows.length === 0 && !missing && online ? (
        <Text style={styles.hint}>No assigned equipment.</Text>
      ) : null}
      {rows.map((r) => (
        <View key={r.assignmentId} style={styles.card}>
          <Text style={styles.name}>{r.name}</Text>
          <Text style={styles.meta}>
            {r.assetTag}
            {r.category ? ` · ${r.category}` : ''} · {r.status ?? 'ASSIGNED'}
          </Text>
          {r.confirmedAt ? (
            <Text style={styles.ok}>Confirmed</Text>
          ) : (
            <Pressable
              style={styles.btn}
              disabled={busyId === r.assignmentId}
              onPress={() => void onConfirm(r.assignmentId)}
            >
              {busyId === r.assignmentId ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Confirm I have this</Text>
              )}
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  hint: { color: '#556677', fontSize: 13, lineHeight: 18 },
  ok: { color: '#1b6b3a' },
  error: { color: '#b3261e' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    gap: 6,
  },
  name: { fontWeight: '700', color: '#0f2744', fontSize: 16 },
  meta: { color: '#556677', fontSize: 13 },
  btn: {
    backgroundColor: '#0f2744',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
