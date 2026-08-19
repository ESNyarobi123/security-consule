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
  listIncidents,
  updateStatus,
  type Incident,
} from '@/services/incidents';

export default function IncidentsScreen() {
  const online = useOnline();
  const { site } = useSiteDuty();
  const [rows, setRows] = useState<Incident[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site?.id) return;
    setBusy(true);
    setError(null);
    try {
      const all = await listIncidents(site.id);
      setRows(all.filter((i) => i.status !== 'CLOSED'));
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

  async function act(
    item: Incident,
    kind: 'INVESTIGATING' | 'RESOLVED' | 'CLOSED',
  ) {
    if (!online) return;
    setActing(`${kind}-${item.id}`);
    setError(null);
    try {
      if (kind === 'INVESTIGATING') {
        await updateStatus(item.id, { status: 'INVESTIGATING' });
      } else if (kind === 'RESOLVED') {
        const resolution = note.trim();
        if (resolution.length < 8) {
          throw new Error('Enter a resolution (min 8 characters) above');
        }
        await updateStatus(item.id, { status: 'RESOLVED', resolution });
      } else {
        const resolution = note.trim();
        if (resolution.length < 8) {
          throw new Error('Enter resolution / closure note (min 8) above');
        }
        await updateStatus(item.id, {
          status: 'CLOSED',
          resolution,
          closureApprovalNote: resolution,
        });
      }
      setNote('');
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
        <Text style={styles.warn}>Offline — status actions disabled.</Text>
      ) : null}
      <Text style={styles.hint}>
        Reporter cannot resolve or close. Closer cannot be the resolver.
        Closure is role-gated (BOM / Ops Mgr+).
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Resolution / closure note"
        value={note}
        onChangeText={setNote}
        multiline
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
          ListEmptyComponent={
            <Text style={styles.empty}>No open incidents at this site.</Text>
          }
          renderItem={({ item }) => {
            const next = item.allowedNextStatuses ?? [];
            return (
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
                {item.blockedReason ? (
                  <Text style={styles.warn}>{item.blockedReason}</Text>
                ) : null}
                <View style={styles.actions}>
                  {next.includes('INVESTIGATING') ? (
                    <Pressable
                      style={[
                        styles.btn,
                        (!online || acting === `INVESTIGATING-${item.id}`) &&
                          styles.disabled,
                      ]}
                      disabled={!online || acting === `INVESTIGATING-${item.id}`}
                      onPress={() => void act(item, 'INVESTIGATING')}
                    >
                      <Text style={styles.btnText}>Investigate</Text>
                    </Pressable>
                  ) : null}
                  {next.includes('RESOLVED') ? (
                    <Pressable
                      style={[
                        styles.btn,
                        (!online || acting === `RESOLVED-${item.id}`) &&
                          styles.disabled,
                      ]}
                      disabled={!online || acting === `RESOLVED-${item.id}`}
                      onPress={() => void act(item, 'RESOLVED')}
                    >
                      <Text style={styles.btnText}>Resolve</Text>
                    </Pressable>
                  ) : null}
                  {next.includes('CLOSED') ? (
                    <Pressable
                      style={[
                        styles.btnGhost,
                        (!online || acting === `CLOSED-${item.id}`) &&
                          styles.disabled,
                      ]}
                      disabled={!online || acting === `CLOSED-${item.id}`}
                      onPress={() => void act(item, 'CLOSED')}
                    >
                      <Text style={styles.btnGhostText}>Close</Text>
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
  input: {
    borderWidth: 1,
    borderColor: '#c5d0dc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 64,
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
  status: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667788',
    textTransform: 'uppercase',
  },
  title: { fontWeight: '700', color: '#0f2744', fontSize: 16 },
  meta: { color: '#667788', fontSize: 12 },
  desc: { color: '#334455', fontSize: 14, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
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
