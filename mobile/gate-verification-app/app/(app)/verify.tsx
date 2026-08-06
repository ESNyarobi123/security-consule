import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { DEMO_SITE_CODE } from '@/constants/config';
import { useDuty } from '@/hooks/useDuty';
import { useOnline } from '@/hooks/useOnline';
import { newClientEventId } from '@/lib/uuid';
import { exitGateVisitor, verifyGateCode } from '@/services/verify';

/** Uppercase + strip spaces for stable compare / submit. */
function normalizeCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

type Mode = 'entry' | 'exit';

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: Mode = params.mode === 'exit' ? 'exit' : 'entry';
  const online = useOnline();
  const { site, selectedGate } = useDuty();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Retains clientEventId across unclear retries of the same code. */
  const attemptRef = useRef<{
    mode: Mode;
    code: string;
    clientEventId: string;
  } | null>(null);

  async function onSubmit() {
    if (!site?.id || !selectedGate?.id) {
      setError('Select site and gate on Duty first');
      return;
    }
    if (!online) {
      setError(
        mode === 'exit'
          ? 'Exit punch requires an online connection'
          : 'Verification requires an online connection',
      );
      return;
    }
    const normalized =
      mode === 'exit' && /^VIS-/i.test(code.trim())
        ? code.trim().toUpperCase()
        : normalizeCode(code);
    if (normalized.length < 4) {
      setError(
        mode === 'exit'
          ? 'Enter verification code or visit reference'
          : 'Enter the visitor verification code',
      );
      return;
    }

    let clientEventId: string;
    if (
      attemptRef.current?.code === normalized &&
      attemptRef.current?.mode === mode
    ) {
      clientEventId = attemptRef.current.clientEventId;
    } else {
      clientEventId = newClientEventId();
      attemptRef.current = { mode, code: normalized, clientEventId };
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === 'exit') {
        const response = await exitGateVisitor({
          code: normalized,
          siteId: site.id,
          gateId: selectedGate.id,
          clientEventId,
        });
        attemptRef.current = null;
        setCode('');
        setPhone('');
        router.replace({
          pathname: '/(app)/result',
          params: {
            allowed: response.allowed ? '1' : '0',
            exited: response.exited ? '1' : '0',
            result: response.result,
            visitorName: response.entry.visitorName,
            direction: response.entry.direction ?? 'OUT',
            denyReason: '',
            alerted: '0',
          },
        });
      } else {
        const response = await verifyGateCode({
          code: normalized,
          siteId: site.id,
          gateId: selectedGate.id,
          clientEventId,
          visitorPhone: phone.trim() || undefined,
        });
        attemptRef.current = null;
        setCode('');
        setPhone('');
        const hostNotified =
          !!response.hostNotified?.sms || !!response.hostNotified?.email;
        router.replace({
          pathname: '/(app)/result',
          params: {
            allowed: response.allowed ? '1' : '0',
            exited: '0',
            result: response.result,
            visitorName: response.entry.visitorName,
            direction: response.entry.direction ?? 'IN',
            denyReason: response.entry.denyReason ?? '',
            alerted: response.fieldAlertId ? '1' : '0',
            hostNotified: hostNotified ? '1' : '0',
            idType:
              response.idType ?? response.entry.idType ?? '',
            idNumber:
              response.idNumber ?? response.entry.idNumber ?? '',
          },
        });
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : mode === 'exit'
            ? 'Exit punch failed'
            : 'Verification failed',
      );
    } finally {
      setBusy(false);
    }
  }

  const isExit = mode === 'exit';

  return (
    <View style={styles.root}>
      <Text style={styles.meta}>
        {DEMO_SITE_CODE} · {selectedGate?.code ?? '—'}
      </Text>

      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeChip, !isExit && styles.modeChipActive]}
          onPress={() => {
            setMode('entry');
            setError(null);
          }}
          disabled={busy}
        >
          <Text style={[styles.modeChipText, !isExit && styles.modeChipTextActive]}>
            Entry
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeChip, isExit && styles.modeChipActiveExit]}
          onPress={() => {
            setMode('exit');
            setError(null);
          }}
          disabled={busy}
        >
          <Text
            style={[styles.modeChipText, isExit && styles.modeChipTextActive]}
          >
            Exit
          </Text>
        </Pressable>
      </View>

      <Text style={styles.title}>
        {isExit ? 'Record visitor exit' : 'Enter visitor code'}
      </Text>
      <Text style={styles.sub}>
        {isExit
          ? 'Use the same verification code (or visit reference). Exit completes the visit.'
          : 'Code is used once for entry and is not stored on the device.'}
      </Text>

      <Text style={styles.label}>
        {isExit ? 'Verification code or reference' : 'Verification code'}
      </Text>
      <TextInput
        style={styles.input}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        textContentType="oneTimeCode"
        value={code}
        onChangeText={setCode}
        editable={!busy}
        placeholder={isExit ? 'OTP or VIS-…' : 'OTP'}
        placeholderTextColor="#99aabb"
      />

      {!isExit ? (
        <>
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
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[
          isExit ? styles.primaryExit : styles.primary,
          (busy || !online) && styles.disabled,
        ]}
        onPress={() => void onSubmit()}
        disabled={busy || !online}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>
            {isExit ? 'Record exit' : 'Verify'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, gap: 8 },
  meta: { color: '#667788', fontWeight: '600', fontSize: 13 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  modeChip: {
    borderWidth: 1,
    borderColor: '#0f2744',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  modeChipActive: { backgroundColor: '#0f2744' },
  modeChipActiveExit: { backgroundColor: '#004578', borderColor: '#004578' },
  modeChipText: { color: '#0f2744', fontWeight: '700', fontSize: 13 },
  modeChipTextActive: { color: '#fff' },
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
  primaryExit: {
    marginTop: 20,
    backgroundColor: '#004578',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
});
