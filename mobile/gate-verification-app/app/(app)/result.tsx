import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function ResultScreen() {
  const params = useLocalSearchParams<{
    allowed?: string;
    result?: string;
    visitorName?: string;
    denyReason?: string;
  }>();

  const allowed = params.allowed === '1';
  const result = params.result ?? (allowed ? 'ALLOWED' : 'DENIED');
  const visitorName = params.visitorName?.trim() || 'Visitor';
  const denyReason = params.denyReason?.trim();

  function onClear() {
    router.replace('/(app)/verify');
  }

  return (
    <View style={[styles.root, allowed ? styles.rootAllow : styles.rootDeny]}>
      <Text style={styles.verdict}>{allowed ? 'ALLOWED' : 'DENIED'}</Text>
      <Text style={styles.resultCode}>{result}</Text>
      <Text style={styles.name}>{visitorName}</Text>
      {!allowed && denyReason ? (
        <Text style={styles.reason}>{denyReason}</Text>
      ) : null}

      <Pressable style={styles.clear} onPress={onClear}>
        <Text style={styles.clearText}>Clear for next</Text>
      </Pressable>

      <Pressable
        style={styles.home}
        onPress={() => router.replace('/(app)')}
      >
        <Text style={styles.homeText}>Back to duty</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  rootAllow: { backgroundColor: '#1b6b3a' },
  rootDeny: { backgroundColor: '#8b1e1e' },
  verdict: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 2,
  },
  resultCode: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  name: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  reason: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  clear: {
    marginTop: 40,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 220,
    alignItems: 'center',
  },
  clearText: { color: '#0f2744', fontWeight: '700', fontSize: 16 },
  home: { paddingVertical: 12 },
  homeText: { color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
});
