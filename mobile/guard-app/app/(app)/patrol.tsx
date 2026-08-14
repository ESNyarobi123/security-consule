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
import { useOnline } from '@/hooks/useOnline';
import {
  enqueuePatrolIssueReport,
  enqueuePatrolRouteScan,
  formatGpsLabel,
  listPatrolRoutes,
  type PatrolIssueSeverity,
  type PatrolRouteSummary,
} from '@/services/patrol';
import { resolveDemoSite } from '@/services/sites';

export default function PatrolScreen() {
  const online = useOnline();
  const [routes, setRoutes] = useState<PatrolRouteSummary[]>([]);
  const [routeId, setRouteId] = useState('');
  const [checkpointId, setCheckpointId] = useState('');
  const [token, setToken] = useState('');
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [severity, setSeverity] = useState<PatrolIssueSeverity>('MEDIUM');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRoutes = useCallback(async () => {
    setError(null);
    try {
      const site = await resolveDemoSite();
      const list = await listPatrolRoutes(site.id, { allowCache: true });
      setRoutes(list);
      setRouteId((current) => current || list[0]?.id || '');
      setCheckpointId(
        (current) => current || list[0]?.checkpoints[0]?.id || '',
      );
    } catch (e) {
      setRoutes([]);
      setError(
        e instanceof Error
          ? e.message
          : 'Patrol routes unavailable. Open this screen online once to cache.',
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRoutes();
    }, [loadRoutes]),
  );

  const selectedRoute = routes.find((route) => route.id === routeId);
  const selectedCheckpoint = selectedRoute?.checkpoints.find(
    (checkpoint) => checkpoint.id === checkpointId,
  );

  function selectRoute(route: PatrolRouteSummary) {
    setRouteId(route.id);
    setCheckpointId(route.checkpoints[0]?.id ?? '');
    setToken('');
  }

  async function onQueueScan() {
    if (!selectedRoute || !selectedCheckpoint) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { row, gps } = await enqueuePatrolRouteScan(
        selectedRoute,
        selectedCheckpoint,
        token,
      );
      setMessage(
        `Queued scan for ${selectedCheckpoint.code} · ${row.clientEventId.slice(0, 8)}… · ${formatGpsLabel(gps)} — sync from Outbox.`,
      );
      setToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Patrol scan failed');
    } finally {
      setBusy(false);
    }
  }

  async function onQueueIssue() {
    if (!selectedRoute) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { row, gps } = await enqueuePatrolIssueReport({
        route: selectedRoute,
        checkpointId: selectedCheckpoint?.id,
        title: issueTitle,
        description: issueDescription,
        severity,
      });
      setMessage(
        `Queued PATROL_ISSUE · ${row.clientEventId.slice(0, 8)}… · ${formatGpsLabel(gps)}. It becomes an incident after Outbox sync.`,
      );
      setIssueTitle('');
      setIssueDescription('');
      setIssueOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Patrol issue failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>
        Select a patrol route and checkpoint, then scan or enter the physical
        QR/NFC token. Routes cache for offline duty; GPS is captured for scans
        and issue reports.
      </Text>

      <Text style={styles.label}>Patrol route</Text>
      <View style={styles.chips}>
        {routes.map((route) => (
          <Pressable
            key={route.id}
            style={[styles.chip, route.id === routeId && styles.chipActive]}
            onPress={() => selectRoute(route)}
          >
            <Text
              style={[
                styles.chipText,
                route.id === routeId && styles.chipTextActive,
              ]}
            >
              {route.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Checkpoint</Text>
      <View style={styles.chips}>
        {(selectedRoute?.checkpoints ?? []).map((checkpoint) => (
          <Pressable
            key={checkpoint.id}
            style={[
              styles.chip,
              checkpoint.id === checkpointId && styles.chipActive,
            ]}
            onPress={() => {
              setCheckpointId(checkpoint.id);
              setToken('');
            }}
          >
            <Text
              style={[
                styles.chipText,
                checkpoint.id === checkpointId && styles.chipTextActive,
              ]}
            >
              {checkpoint.code}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>QR / NFC token</Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="Scan or enter physical token"
      />

      <Text style={styles.meta}>
        {routes.length > 0
          ? `${routes.length} route(s) ${online ? 'loaded' : 'from cache'}`
          : online
            ? 'No active patrol routes for site'
            : 'Offline — need cached patrol routes'}
      </Text>

      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primary, busy && styles.disabled]}
        onPress={() => void onQueueScan()}
        disabled={busy || !token.trim() || !selectedCheckpoint}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Queue patrol scan</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.issueButton}
        onPress={() => setIssueOpen((open) => !open)}
        disabled={!selectedRoute}
      >
        <Text style={styles.issueButtonText}>
          {issueOpen ? 'Cancel issue report' : 'Report patrol issue'}
        </Text>
      </Pressable>

      {issueOpen ? (
        <View style={styles.issuePanel}>
          <Text style={styles.label}>Issue title</Text>
          <TextInput
            style={styles.input}
            value={issueTitle}
            onChangeText={setIssueTitle}
            placeholder="e.g. Broken perimeter light"
          />
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={issueDescription}
            onChangeText={setIssueDescription}
            placeholder="Describe what you observed"
            multiline
          />
          <Text style={styles.label}>Severity</Text>
          <View style={styles.chips}>
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((level) => (
              <Pressable
                key={level}
                style={[styles.chip, severity === level && styles.chipActive]}
                onPress={() => setSeverity(level)}
              >
                <Text
                  style={[
                    styles.chipText,
                    severity === level && styles.chipTextActive,
                  ]}
                >
                  {level}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            onPress={() => void onQueueIssue()}
            disabled={
              busy || !issueTitle.trim() || !issueDescription.trim()
            }
          >
            <Text style={styles.primaryText}>Queue incident report</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={[styles.secondary, !online && styles.disabled]}
        onPress={() => void loadRoutes()}
        disabled={!online}
      >
        <Text style={styles.secondaryText}>Refresh patrol routes</Text>
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
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: '#b8c5d1',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: '#0f2744', backgroundColor: '#0f2744' },
  chipText: { color: '#40556b', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
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
  issueButton: {
    borderWidth: 1,
    borderColor: '#b45309',
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  issueButtonText: { color: '#92400e', fontWeight: '700' },
  issuePanel: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fffaf5',
    borderRadius: 10,
    padding: 12,
  },
  disabled: { opacity: 0.5 },
});
