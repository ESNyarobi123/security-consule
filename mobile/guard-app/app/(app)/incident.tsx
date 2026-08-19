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
  enqueueIncidentReport,
  listIncidentCategories,
  type IncidentCategoryOption,
  type IncidentSeverity,
} from '@/services/field';
import { formatGpsLabel } from '@/services/location';

const SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function IncidentScreen() {
  const online = useOnline();
  const [categories, setCategories] = useState<IncidentCategoryOption[]>([]);
  const [category, setCategory] = useState('SECURITY_BREACH');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!online) return;
      void listIncidentCategories()
        .then((rows) => {
          setCategories(rows);
          setCategory((c) => c || rows[0]?.value || 'SECURITY_BREACH');
        })
        .catch(() => undefined);
    }, [online]),
  );

  async function onQueue() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { row, gps } = await enqueueIncidentReport({
        category,
        title,
        description,
        severity,
      });
      setMessage(
        `Queued incident ${row.clientEventId.slice(0, 8)}… · ${formatGpsLabel(gps)} — sync from Outbox.`,
      );
      setTitle('');
      setDescription('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Incident failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.hint}>
        Report a site incident to supervisors. You cannot close your own case.
        Camera evidence stays deferred — GPS is attached for audit.
      </Text>
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal style={styles.chips}>
        {(categories.length ? categories : [{ value: category, label: category }]).map(
          (c) => (
            <Pressable
              key={c.value}
              style={[styles.chip, category === c.value && styles.chipOn]}
              onPress={() => setCategory(c.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  category === c.value && styles.chipTextOn,
                ]}
              >
                {c.label}
              </Text>
            </Pressable>
          ),
        )}
      </ScrollView>

      <Text style={styles.label}>Severity</Text>
      <View style={styles.row}>
        {SEVERITIES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, severity === s && styles.chipOn]}
            onPress={() => setSeverity(s)}
          >
            <Text
              style={[styles.chipText, severity === s && styles.chipTextOn]}
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Short title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, styles.area]}
        placeholder="What happened (min 10 characters)"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Pressable
        style={[styles.primary, busy && styles.disabled]}
        onPress={() => void onQueue()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Queue incident</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 10 },
  hint: { color: '#556677', fontSize: 13, lineHeight: 18 },
  ok: { color: '#1b6b3a' },
  error: { color: '#b3261e' },
  label: { color: '#667788', fontSize: 12, textTransform: 'uppercase' },
  chips: { flexGrow: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: '#0f2744',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  chipOn: { backgroundColor: '#0f2744' },
  chipText: { color: '#0f2744', fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    padding: 12,
    color: '#0f2744',
  },
  area: { minHeight: 90, textAlignVertical: 'top' },
  primary: {
    backgroundColor: '#0f2744',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.7 },
});
