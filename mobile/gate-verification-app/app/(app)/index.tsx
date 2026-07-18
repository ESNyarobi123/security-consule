import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { DEMO_SITE_CODE } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import { useDuty } from '@/hooks/useDuty';
import { useOnline } from '@/hooks/useOnline';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const online = useOnline();
  const { ready, site, gates, selectedGate, error, selectGate, refresh } =
    useDuty();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View
          style={[
            styles.badge,
            online ? styles.badgeOnline : styles.badgeOffline,
          ]}
        >
          <Text style={styles.badgeText}>{online ? 'Online' : 'Offline'}</Text>
        </View>
        <Text style={styles.mode}>OTP online-only</Text>
      </View>

      <Text style={styles.hello}>Hi, {user?.fullName ?? 'Gate officer'}</Text>
      <Text style={styles.meta}>{user?.email}</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Duty site</Text>
        <Text style={styles.cardValue}>{DEMO_SITE_CODE}</Text>
        <Text style={styles.cardMeta}>
          {site
            ? `${site.name} · ${site.id.slice(0, 8)}…`
            : ready
              ? 'Site unresolved — check connection'
              : 'Loading site…'}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Gate</Text>
      {!ready ? (
        <ActivityIndicator color="#0f2744" />
      ) : (
        <View style={styles.gateRow}>
          {gates.map((gate) => {
            const active = selectedGate?.id === gate.id;
            return (
              <Pressable
                key={gate.id}
                style={[styles.gateChip, active && styles.gateChipActive]}
                onPress={() => void selectGate(gate)}
              >
                <Text
                  style={[
                    styles.gateChipText,
                    active && styles.gateChipTextActive,
                  ]}
                >
                  {gate.code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!online ? (
        <Text style={styles.warn}>
          Offline — verification requires a live connection.
        </Text>
      ) : null}

      <Link href="/(app)/verify" asChild>
        <Pressable
          style={[
            styles.primary,
            (!selectedGate || !online) && styles.disabled,
          ]}
          disabled={!selectedGate || !online}
        >
          <Text style={styles.primaryText}>Verify visitor code</Text>
        </Pressable>
      </Link>

      <Pressable style={styles.logout} onPress={() => void logout()}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOnline: { backgroundColor: '#d6f5e3' },
  badgeOffline: { backgroundColor: '#fde2e1' },
  badgeText: { fontWeight: '700', color: '#1a2b3c', fontSize: 12 },
  mode: { color: '#445566', fontWeight: '600', fontSize: 12 },
  hello: { fontSize: 24, fontWeight: '700', color: '#0f2744', marginTop: 8 },
  meta: { color: '#667788', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    gap: 4,
  },
  cardLabel: {
    color: '#667788',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardValue: { fontSize: 18, fontWeight: '700', color: '#0f2744' },
  cardMeta: { color: '#556677', fontSize: 13 },
  sectionLabel: {
    color: '#667788',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  gateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gateChip: {
    borderWidth: 1,
    borderColor: '#0f2744',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  gateChipActive: { backgroundColor: '#0f2744' },
  gateChipText: { color: '#0f2744', fontWeight: '700', fontSize: 13 },
  gateChipTextActive: { color: '#fff' },
  error: { color: '#b3261e' },
  warn: { color: '#8a5a00', fontSize: 13 },
  primary: {
    backgroundColor: '#0f2744',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logout: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  logoutText: { color: '#8899aa' },
  disabled: { opacity: 0.5 },
});
