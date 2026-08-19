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
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import { useSiteDuty } from '@/hooks/useSiteDuty';
import {
  approveEob,
  createHandoverNote,
  createInspection,
  listEob,
  type EobEntry,
} from '@/services/eob';

export default function EobScreen() {
  const online = useOnline();
  const { user } = useAuth();
  const { site } = useSiteDuty();
  const [rows, setRows] = useState<EobEntry[]>([]);
  const [inspectNote, setInspectNote] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site?.id) return;
    setBusy(true);
    setError(null);
    try {
      const entries = await listEob(site.id);
      const current = entries.filter((e) => e.isCurrent !== false);
      const sorted = [...current].sort((a, b) => {
        const ta = new Date(a.recordedAt || a.occurredAt || a.createdAt || 0).getTime();
        const tb = new Date(b.recordedAt || b.occurredAt || b.createdAt || 0).getTime();
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

  async function onInspect() {
    if (!online || !site?.id) return;
    if (inspectNote.trim().length < 10) {
      setError('Inspection note must be at least 10 characters');
      return;
    }
    setActing('inspect');
    setError(null);
    try {
      await createInspection(site.id, inspectNote.trim());
      setInspectNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inspection failed');
    } finally {
      setActing(null);
    }
  }

  async function onHandover() {
    if (!online || !site?.id) return;
    if (handoverNote.trim().length < 10) {
      setError('Shift report must be at least 10 characters');
      return;
    }
    setActing('handover');
    setError(null);
    try {
      await createHandoverNote(site.id, handoverNote.trim());
      setHandoverNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shift report failed');
    } finally {
      setActing(null);
    }
  }

  async function onApprove(id: string) {
    if (!online) return;
    setActing(id);
    setError(null);
    try {
      await approveEob(id);
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
        <Text style={styles.warn}>Offline — create / approve disabled.</Text>
      ) : null}
      <Text style={styles.hint}>
        Site inspection = SUPERVISOR_COMMENT. Shift report = HANDOVER_NOTE.
        Second officer must approve (recorder ≠ approver).
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Inspection note (min 10)"
        value={inspectNote}
        onChangeText={setInspectNote}
        multiline
      />
      <Pressable
        style={[styles.btn, (!online || acting === 'inspect') && styles.disabled]}
        disabled={!online || acting === 'inspect'}
        onPress={() => void onInspect()}
      >
        <Text style={styles.btnText}>
          {acting === 'inspect' ? '…' : 'Record inspection'}
        </Text>
      </Pressable>
      <TextInput
        style={styles.input}
        placeholder="Shift handover / report (min 10)"
        value={handoverNote}
        onChangeText={setHandoverNote}
        multiline
      />
      <Pressable
        style={[styles.btn, (!online || acting === 'handover') && styles.disabled]}
        disabled={!online || acting === 'handover'}
        onPress={() => void onHandover()}
      >
        <Text style={styles.btnText}>
          {acting === 'handover' ? '…' : 'Submit shift report'}
        </Text>
      </Pressable>
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
            const when = item.recordedAt || item.occurredAt || item.createdAt;
            const pending = !item.approvedBy;
            const selfRecorder = item.officerId && item.officerId === user?.id;
            return (
              <View style={styles.row}>
                <Text style={styles.cat}>{item.category}</Text>
                <Text style={styles.desc}>{item.description}</Text>
                <Text style={styles.meta}>
                  {item.officerName || item.officerId || 'Officer'}
                  {pending ? ' · pending approval' : ` · ${item.approvedByName ?? 'approved'}`}
                  {when ? ` · ${new Date(when).toLocaleString()}` : ''}
                </Text>
                {pending && !selfRecorder ? (
                  <Pressable
                    style={[
                      styles.btn,
                      (!online || acting === item.id) && styles.disabled,
                    ]}
                    disabled={!online || acting === item.id}
                    onPress={() => void onApprove(item.id)}
                  >
                    <Text style={styles.btnText}>
                      {acting === item.id ? '…' : 'Approve report'}
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
  error: { color: '#b3261e', marginVertical: 8 },
  empty: { color: '#667788', marginTop: 24, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#c5d0dc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 56,
    marginBottom: 8,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
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
  btn: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    backgroundColor: '#0f2744',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.45 },
});
