import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useOnline } from '@/hooks/useOnline';
import { raiseGuardEmergency } from '@/services/field';

export default function EmergencyScreen() {
  const online = useOnline();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPanic() {
    if (!online) {
      setError(
        'Emergency needs a live connection so supervisors see the FieldAlert now.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const row = await raiseGuardEmergency(note);
      setMessage(
        `HIGH FieldAlert sent (${row.alertType}). Supervisors see this on the field-alert board. You cannot acknowledge your own alert.`,
      );
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Emergency failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>
        Raises a HIGH field alert at SUPERVISOR stage for your assigned site.
        Use only for real emergencies. Not a chat — supervisors ack on their
        board.
      </Text>
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Optional short note"
        value={note}
        onChangeText={setNote}
      />
      <Pressable
        style={[styles.panic, busy && styles.disabled]}
        onPress={() => void onPanic()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.panicText}>Send emergency alert</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, gap: 12 },
  hint: { color: '#556677', fontSize: 13, lineHeight: 18 },
  ok: { color: '#1b6b3a' },
  error: { color: '#b3261e' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    padding: 12,
    color: '#0f2744',
  },
  panic: {
    backgroundColor: '#9b1c1c',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  panicText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.7 },
});
