import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useOnline } from '@/hooks/useOnline';
import {
  listMyParkingPatrolObservations,
  submitParkingPatrolObservation,
  type ParkingPatrolObservation,
  type ParkingPatrolObservationType,
} from '@/services/parking-patrol';

const TYPES: { id: ParkingPatrolObservationType; label: string }[] = [
  { id: 'IRREGULARITY', label: 'Irregularity' },
  { id: 'SECURITY_OBSERVATION', label: 'Security note' },
  { id: 'ACCIDENT', label: 'Accident' },
  { id: 'SUSPICIOUS_ACTIVITY', label: 'Suspicious' },
  { id: 'DAMAGE', label: 'Damage' },
  { id: 'ILLEGAL_PARKING', label: 'Illegal parking' },
  { id: 'ABANDONED_VEHICLE', label: 'Abandoned vehicle' },
  { id: 'OTHER', label: 'Other' },
];

export default function ParkingPatrolScreen() {
  const online = useOnline();
  const [parkingArea, setParkingArea] = useState('Lot A');
  const [observationType, setObservationType] =
    useState<ParkingPatrolObservationType>('ILLEGAL_PARKING');
  const [plateNumber, setPlateNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ParkingPatrolObservation[]>([]);

  const loadRecent = useCallback(async () => {
    if (!online) return;
    try {
      const list = await listMyParkingPatrolObservations();
      setRecent(list.slice(0, 8));
    } catch {
      /* ignore list errors on thin screen */
    }
  }, [online]);

  useFocusEffect(
    useCallback(() => {
      void loadRecent();
    }, [loadRecent]),
  );

  async function onSubmit() {
    if (!online) {
      setError('Parking patrol requires online (offline outbox deferred).');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const row = await submitParkingPatrolObservation({
        parkingArea,
        observationType,
        plateNumber: plateNumber || undefined,
        notes: notes || undefined,
      });
      setMessage(
        `Saved ${row.observationType}${
          row.fieldAlertId ? ' · FieldAlert raised' : ''
        }`,
      );
      setNotes('');
      setPlateNumber('');
      await loadRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.hint}>
        Record parking inspection: area, plate, and observation type. High
        severity / accident / suspicious / abandoned raise a FieldAlert for ops.
      </Text>

      {!online ? (
        <Text style={styles.warn}>Offline — submit when online.</Text>
      ) : null}

      <Text style={styles.label}>Parking area</Text>
      <TextInput
        style={styles.input}
        value={parkingArea}
        onChangeText={setParkingArea}
        placeholder="Lot / zone / bay row"
      />

      <Text style={styles.label}>Observation type</Text>
      <View style={styles.chips}>
        {TYPES.map((t) => (
          <Pressable
            key={t.id}
            style={[
              styles.chip,
              observationType === t.id && styles.chipActive,
            ]}
            onPress={() => setObservationType(t.id)}
          >
            <Text
              style={[
                styles.chipText,
                observationType === t.id && styles.chipTextActive,
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Plate (optional)</Text>
      <TextInput
        style={styles.input}
        value={plateNumber}
        onChangeText={setPlateNumber}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="T123ABC"
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Damage, illegal parking detail, security observation…"
      />

      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primary, (busy || !online) && styles.disabled]}
        onPress={() => void onSubmit()}
        disabled={busy || !online || !parkingArea.trim()}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Submit observation</Text>
        )}
      </Pressable>

      {recent.length > 0 ? (
        <View style={styles.recent}>
          <Text style={styles.recentTitle}>Recent (yours)</Text>
          {recent.map((r) => (
            <View key={r.id} style={styles.recentRow}>
              <Text style={styles.recentMain}>
                {r.observationType.replace(/_/g, ' ')}
                {r.plateNumber ? ` · ${r.plateNumber}` : ''}
              </Text>
              <Text style={styles.recentMeta}>
                {r.parkingArea} · {r.severity}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 10, paddingBottom: 40 },
  hint: { color: '#445566', fontSize: 13, lineHeight: 18 },
  warn: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: 10,
    borderRadius: 8,
    fontWeight: '600',
    fontSize: 13,
  },
  label: { fontWeight: '700', color: '#0f2744', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#c5d0db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#0f2744',
  },
  notes: { minHeight: 88, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c5d0db',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#0f2744', borderColor: '#0f2744' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#f4f7fb' },
  primary: {
    marginTop: 8,
    backgroundColor: '#0f2744',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  ok: { color: '#0f766e', fontWeight: '600' },
  error: { color: '#be123c', fontWeight: '600' },
  recent: { marginTop: 16, gap: 8 },
  recentTitle: { fontWeight: '700', color: '#0f2744' },
  recentRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
  },
  recentMain: { fontWeight: '600', color: '#0f2744', fontSize: 13 },
  recentMeta: { color: '#64748b', fontSize: 12, marginTop: 2 },
});
