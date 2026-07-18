import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { DEMO_SITE_CODE } from '@/constants/config';
import { useDuty } from '@/hooks/useDuty';
import { useOnline } from '@/hooks/useOnline';
import { newClientEventId } from '@/lib/uuid';
import { verifyGateCode } from '@/services/verify';

/** Uppercase + strip spaces for stable compare / submit. */
function normalizeCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

export default function VerifyScreen() {
  const online = useOnline();
  const { site, selectedGate } = useDuty();
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Retains clientEventId across unclear retries of the same code. */
  const attemptRef = useRef<{ code: string; clientEventId: string } | null>(
    null,
  );

  async function onSubmit() {
    if (!site?.id || !selectedGate?.id) {
      setError('Select site and gate on Duty first');
      return;
    }
    if (!online) {
      setError('Verification requires an online connection');
      return;
    }
    const normalized = normalizeCode(code);
    if (normalized.length < 4) {
      setError('Enter the visitor verification code');
      return;
    }

    let clientEventId: string;
    if (attemptRef.current?.code === normalized) {
      clientEventId = attemptRef.current.clientEventId;
    } else {
      clientEventId = newClientEventId();
      attemptRef.current = { code: normalized, clientEventId };
    }

    setBusy(true);
    setError(null);
    try {
      const response = await verifyGateCode({
        code: normalized,
        siteId: site.id,
        gateId: selectedGate.id,
        clientEventId,
        visitorPhone: phone.trim() || undefined,
      });
      // Clear ephemeral code immediately — never persist in storage/history.
      attemptRef.current = null;
      setCode('');
      setPhone('');
      router.replace({
        pathname: '/(app)/result',
        params: {
          allowed: response.allowed ? '1' : '0',
          result: response.result,
          visitorName: response.entry.visitorName,
          denyReason: response.entry.denyReason ?? '',
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.meta}>
        {DEMO_SITE_CODE} · {selectedGate?.code ?? '—'}
      </Text>
      <Text style={styles.title}>Enter visitor code</Text>
      <Text style={styles.sub}>
        Code is used once for this check and is not stored on the device.
      </Text>

      <Text style={styles.label}>Verification code</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        textContentType="oneTimeCode"
        value={code}
        onChangeText={setCode}
        editable={!busy}
        placeholder="OTP"
        placeholderTextColor="#99aabb"
      />

      <Text style={styles.label}>Visitor phone (optional)</Text>
      <TextInput
        style={styles.input}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        editable={!busy}
        placeholder="+255…"
        placeholderTextColor="#99aabb"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primary, (busy || !online) && styles.disabled]}
        onPress={() => void onSubmit()}
        disabled={busy || !online}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Verify</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, gap: 8 },
  meta: { color: '#667788', fontWeight: '600', fontSize: 13 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f2744', marginTop: 4 },
  sub: { color: '#667788', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  label: { color: '#445566', fontSize: 13, marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    color: '#0f2744',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    letterSpacing: 2,
    fontWeight: '600',
  },
  error: { color: '#b3261e', marginTop: 8 },
  primary: {
    marginTop: 20,
    backgroundColor: '#0f2744',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
});
