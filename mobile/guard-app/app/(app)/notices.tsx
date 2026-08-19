import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useOnline } from '@/hooks/useOnline';
import { listMyNotices, type EssNotice } from '@/services/field';

export default function NoticesScreen() {
  const online = useOnline();
  const [rows, setRows] = useState<EssNotice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!online) return;
      setError(null);
      setMissing(false);
      void listMyNotices()
        .then(setRows)
        .catch((e: unknown) => {
          const text = e instanceof Error ? e.message : String(e);
          if (/ESS_PROFILE_MISSING/i.test(text) || /linked/i.test(text)) {
            setMissing(true);
          } else {
            setError(text);
          }
        });
    }, [online]),
  );

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.hint}>
        Messages queued to your email or phone — not a company bulletin board.
        Supervisors also see your FieldAlerts on their board.
      </Text>
      {!online ? (
        <Text style={styles.hint}>Online required to load notices.</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {missing ? (
        <Text style={styles.error}>
          Ask HR to link your employee profile to see notices.
        </Text>
      ) : null}
      {rows.length === 0 && online && !missing ? (
        <Text style={styles.hint}>No notices yet.</Text>
      ) : null}
      {rows.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.meta}>
            {r.channel} · {r.templateCode} · {r.status}
          </Text>
          <Text style={styles.name}>{r.subject || 'Notice'}</Text>
          <Text style={styles.body}>{r.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, gap: 12 },
  hint: { color: '#556677', fontSize: 13, lineHeight: 18 },
  error: { color: '#b3261e' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    gap: 4,
  },
  name: { fontWeight: '700', color: '#0f2744' },
  meta: { color: '#667788', fontSize: 11, textTransform: 'uppercase' },
  body: { color: '#323130', fontSize: 13, lineHeight: 18 },
});
