import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import {
  DEMO_GPS,
  DEMO_SITE_CODE,
  DEVICE_TIME_DISCLAIMER,
} from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import { countPending } from '@/offline/outbox';
import { enqueueDemoClockIn } from '@/services/clock-in';
import { enqueueDemoClockOut } from '@/services/clock-out';
import { getOpenAttendanceId } from '@/services/duty-state';
import { resolveDemoSite, type SiteSummary } from '@/services/sites';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const online = useOnline();
  const [pending, setPending] = useState(0);
  const [site, setSite] = useState<SiteSummary | null>(null);
  const [openAttendanceId, setOpenAttendanceIdState] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, s, openId] = await Promise.all([
        countPending(),
        resolveDemoSite().catch(() => null),
        getOpenAttendanceId(),
      ]);
      setPending(c);
      setSite(s);
      setOpenAttendanceIdState(openId);
    } catch {
      /* ignore offline site resolve */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function onClockIn() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { row } = await enqueueDemoClockIn();
      setMessage(
        `Queued CLOCK_IN ${row.clientEventId.slice(0, 8)}… — open Outbox to sync.`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clock-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onClockOut() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const row = await enqueueDemoClockOut();
      setMessage(
        `Queued CLOCK_OUT ${row.clientEventId.slice(0, 8)}… — open Outbox to sync.`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clock-out failed');
    } finally {
      setBusy(false);
    }
  }

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
        <Text style={styles.pending}>Pending: {pending}</Text>
      </View>

      <Text style={styles.hello}>Hi, {user?.fullName ?? 'Guard'}</Text>
      <Text style={styles.meta}>{user?.email}</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Duty site</Text>
        <Text style={styles.cardValue}>{DEMO_SITE_CODE}</Text>
        <Text style={styles.cardMeta}>
          {site
            ? `${site.name} · ${site.id.slice(0, 8)}…`
            : 'Site id resolves on sync / first online'}
        </Text>
        <Text style={styles.cardMeta}>
          Demo GPS {DEMO_GPS.latitude}, {DEMO_GPS.longitude}
        </Text>
        {openAttendanceId ? (
          <Text style={styles.cardMeta}>
            On duty · attendance {openAttendanceId.slice(0, 8)}…
          </Text>
        ) : (
          <Text style={styles.cardMeta}>No open attendance (sync CLOCK_IN)</Text>
        )}
      </View>

      <Text style={styles.disclaimer}>{DEVICE_TIME_DISCLAIMER}</Text>

      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primary, busy && styles.disabled]}
        onPress={() => void onClockIn()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Clock in (queue)</Text>
        )}
      </Pressable>

      {openAttendanceId ? (
        <Pressable
          style={[styles.clockOut, busy && styles.disabled]}
          onPress={() => void onClockOut()}
          disabled={busy}
        >
          <Text style={styles.clockOutText}>Clock out (queue)</Text>
        </Pressable>
      ) : null}

      <View style={styles.links}>
        <Link href="/(app)/alertness" asChild>
          <Pressable style={styles.secondary}>
            <Text style={styles.secondaryText}>Alertness</Text>
          </Pressable>
        </Link>
        <Link href="/(app)/patrol" asChild>
          <Pressable style={styles.secondary}>
            <Text style={styles.secondaryText}>Patrol</Text>
          </Pressable>
        </Link>
        <Link href="/(app)/outbox" asChild>
          <Pressable style={styles.secondary}>
            <Text style={styles.secondaryText}>Outbox</Text>
          </Pressable>
        </Link>
      </View>

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
  pending: { color: '#445566', fontWeight: '600' },
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
  disclaimer: {
    color: '#6a7a8a',
    fontSize: 12,
    lineHeight: 17,
    backgroundColor: '#e8eef4',
    padding: 10,
    borderRadius: 8,
  },
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
  clockOut: {
    backgroundColor: '#5c2d0e',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  clockOutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  links: { gap: 8 },
  secondary: {
    borderWidth: 1,
    borderColor: '#0f2744',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#0f2744', fontWeight: '600' },
  logout: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  logoutText: { color: '#8899aa' },
  disabled: { opacity: 0.7 },
});
