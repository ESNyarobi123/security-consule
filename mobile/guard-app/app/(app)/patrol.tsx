import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { DEMO_CHECKPOINT_QR } from '@/constants/config';
import { useOnline } from '@/hooks/useOnline';
import {
  enqueuePatrolScanByCode,
  listCheckpoints,
  type CheckpointSummary,
} from '@/services/patrol';
import { resolveDemoSite } from '@/services/sites';

export default function PatrolScreen() {
  const online = useOnline();
  const [code, setCode] = useState(DEMO_CHECKPOINT_QR);
  const [checkpoints, setCheckpoints] = useState<CheckpointSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCheckpoints = useCallback(async () => {
    setError(null);
    try {
      const site = await resolveDemoSite();
      const list = await listCheckpoints(site.id, { allowCache: true });
      setCheckpoints(list);
    } catch (e) {
      setCheckpoints([]);
      setError(
        e instanceof Error
          ? e.message
          : 'Checkpoint list not available. Open this screen online once to cache.',
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCheckpoints();
    }, [loadCheckpoints]),
  );

  async function onQueueScan() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { row, checkpoint } = await enqueuePatrolScanByCode(code);
      setMessage(
        `Queued PATROL_SCAN for ${checkpoint.code} · ${row.clientEventId.slice(0, 8)}… — sync from Outbox.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Patrol scan failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>
        Enter checkpoint QR/code (no camera). Default {DEMO_CHECKPOINT_QR}.
        Resolves against GET /operations/checkpoints (cached per site).
      </Text>

      <Text style={styles.label}>Checkpoint code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={DEMO_CHECKPOINT_QR}
      />

      <Text style={styles.meta}>
        {checkpoints.length > 0
          ? `${checkpoints.length} checkpoint(s) ${online ? 'loaded' : 'from cache'}`
          : online
            ? 'No checkpoints for site'
            : 'Offline — need a cached checkpoint list'}
      </Text>

      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primary, busy && styles.disabled]}
        onPress={() => void onQueueScan()}
        disabled={busy || !code.trim()}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Queue patrol scan</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.secondary, !online && styles.disabled]}
        onPress={() => void loadCheckpoints()}
        disabled={!online}
      >
        <Text style={styles.secondaryText}>Refresh checkpoints</Text>
      </Pressable>
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
  label: {
    color: '#667788',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f2744',
    fontWeight: '600',
  },
  meta: { color: '#667788', fontSize: 13 },
  ok: { color: '#1b6b3a' },
  error: { color: '#b3261e' },
  primary: {
    backgroundColor: '#0f2744',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    borderWidth: 1,
    borderColor: '#0f2744',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#0f2744', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
