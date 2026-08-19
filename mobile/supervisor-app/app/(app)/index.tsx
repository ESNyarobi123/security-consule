import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { BOARD_POLL_MS } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import { useSiteDuty } from '@/hooks/useSiteDuty';
import { listFieldAlerts } from '@/services/alerts';
import { listPendingAlertness } from '@/services/alertness';
import { listAttendance } from '@/services/attendance';
import { listIncidents } from '@/services/incidents';
import { listDeployments } from '@/services/operations';

type BoardCounts = {
  onDuty: number;
  deployed: number;
  unackedAlerts: number;
  pendingApprovals: number;
  pendingAlertness: number;
  openIncidents: number;
};

const EMPTY: BoardCounts = {
  onDuty: 0,
  deployed: 0,
  unackedAlerts: 0,
  pendingApprovals: 0,
  pendingAlertness: 0,
  openIncidents: 0,
};

const NAV = [
  { href: '/(app)/attendance' as const, label: 'Verify attendance' },
  { href: '/(app)/shifts' as const, label: 'Shifts & replacements' },
  { href: '/(app)/eob' as const, label: 'Inspect site / EOB' },
  { href: '/(app)/alertness' as const, label: 'Alertness' },
  { href: '/(app)/incidents' as const, label: 'Incidents' },
  { href: '/(app)/patrols' as const, label: 'Patrols' },
  { href: '/(app)/supervise' as const, label: 'Supervise guards' },
  { href: '/(app)/alerts' as const, label: 'Field alerts' },
];

export default function LiveBoardScreen() {
  const { user, logout } = useAuth();
  const online = useOnline();
  const {
    ready,
    sites,
    site,
    error: siteError,
    refresh: refreshSite,
    selectSite,
  } = useSiteDuty();
  const [counts, setCounts] = useState<BoardCounts>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    if (!site?.id || !online) return;
    setBusy(true);
    setError(null);
    try {
      const [attendance, pending, alerts, incidents, deployments, alertness] =
        await Promise.all([
          listAttendance(site.id),
          listAttendance(site.id, false),
          listFieldAlerts(site.id, false),
          listIncidents(site.id),
          listDeployments().catch(() => []),
          listPendingAlertness(site.id).catch(() => []),
        ]);
      const onDuty = attendance.filter((r) => !r.clockOutAt).length;
      const openIncidents = incidents.filter(
        (i) => i.status === 'OPEN' || i.status === 'INVESTIGATING',
      ).length;
      const deployed = deployments.filter(
        (d) => d.siteId === site.id && d.status === 'ACTIVE',
      ).length;
      setCounts({
        onDuty,
        deployed,
        unackedAlerts: alerts.length,
        pendingApprovals: pending.length,
        pendingAlertness: alertness.length,
        openIncidents,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load board');
    } finally {
      setBusy(false);
    }
  }, [site?.id, online]);

  useFocusEffect(
    useCallback(() => {
      void refreshSite();
    }, [refreshSite]),
  );

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    if (!online || !site?.id) return;
    const id = setInterval(() => {
      void loadCounts();
    }, BOARD_POLL_MS);
    return () => clearInterval(id);
  }, [online, site?.id, loadCounts]);

  async function onRefresh() {
    await refreshSite();
    await loadCounts();
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={busy}
          onRefresh={() => void onRefresh()}
          tintColor="#0f2744"
        />
      }
    >
      <View style={styles.row}>
        <View
          style={[
            styles.badge,
            online ? styles.badgeOnline : styles.badgeOffline,
          ]}
        >
          <Text style={styles.badgeText}>{online ? 'Online' : 'Offline'}</Text>
        </View>
        <Text style={styles.mode}>Poll 20s · no outbox</Text>
      </View>

      <Text style={styles.hello}>Hi, {user?.fullName ?? 'Supervisor'}</Text>
      <Text style={styles.meta}>
        {user?.email}
        {user?.roles?.length ? ` · ${user.roles.join(', ')}` : ''}
      </Text>

      <Text style={styles.sectionLabel}>Duty site</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {sites.map((s) => {
            const on = s.id === site?.id;
            return (
              <Pressable
                key={s.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => void selectSite(s.id)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {s.code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Text style={styles.siteMeta}>
        {site
          ? site.name
          : ready
            ? 'No sites in your access scope'
            : 'Loading sites…'}
      </Text>

      {siteError || error ? (
        <Text style={styles.error}>{siteError || error}</Text>
      ) : null}
      {!online ? (
        <Text style={styles.warn}>
          Offline — counts pause; actions disabled.
        </Text>
      ) : null}

      <Text style={styles.sectionLabel}>Live counts</Text>
      {!ready && !site ? (
        <ActivityIndicator color="#0f2744" />
      ) : (
        <View style={styles.counts}>
          <Text style={styles.countLine}>On duty: {counts.onDuty}</Text>
          <Text style={styles.countLine}>
            Deployed at site: {counts.deployed}
          </Text>
          <Text
            style={[
              styles.countLine,
              counts.unackedAlerts > 0 && styles.countHot,
            ]}
          >
            Unacked alerts: {counts.unackedAlerts}
          </Text>
          <Text style={styles.countLine}>
            Pending attendance: {counts.pendingApprovals}
          </Text>
          <Text style={styles.countLine}>
            Pending alertness: {counts.pendingAlertness}
          </Text>
          <Text style={styles.countLine}>
            Open incidents: {counts.openIncidents}
          </Text>
        </View>
      )}

      {NAV.map((item) => (
        <Link key={item.href} href={item.href} asChild>
          <Pressable style={styles.navBtn}>
            <Text style={styles.navBtnText}>{item.label}</Text>
          </Pressable>
        </Link>
      ))}

      <Pressable style={styles.logout} onPress={() => void logout()}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, gap: 10, paddingBottom: 40 },
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
  meta: { color: '#667788', marginBottom: 4 },
  sectionLabel: {
    color: '#667788',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#c5d0dc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: '#0f2744', borderColor: '#0f2744' },
  chipText: { color: '#0f2744', fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: '#fff' },
  siteMeta: { color: '#556677', fontSize: 13 },
  counts: { gap: 6, marginBottom: 8 },
  countLine: { fontSize: 16, color: '#1a2b3c', fontWeight: '600' },
  countHot: { color: '#c62828', fontWeight: '800' },
  error: { color: '#b3261e' },
  warn: { color: '#8a5a00', fontSize: 13 },
  navBtn: {
    backgroundColor: '#0f2744',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  navBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  logout: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  logoutText: { color: '#8899aa' },
});
