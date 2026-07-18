import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { DEFAULT_LOGIN } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { ready, token, login } = useAuth();
  const [email, setEmail] = useState<string>(DEFAULT_LOGIN.email);
  const [password, setPassword] = useState<string>(DEFAULT_LOGIN.password);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ready && token) {
    return <Redirect href="/(app)" />;
  }

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/(app)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>HIGHLINK</Text>
      <Text style={styles.title}>Guard App</Text>
      <Text style={styles.sub}>
        Offline-first clock-in · syncs to core-api :4001
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={() => void onSubmit()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#0f2744" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f2744',
    paddingHorizontal: 24,
    paddingTop: 96,
  },
  brand: {
    color: '#7eb6ff',
    fontSize: 14,
    letterSpacing: 3,
    fontWeight: '700',
  },
  title: {
    color: '#f4f7fb',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8,
  },
  sub: {
    color: '#9fb3c8',
    marginTop: 8,
    marginBottom: 40,
    fontSize: 14,
    lineHeight: 20,
  },
  form: { gap: 8 },
  label: { color: '#c5d4e4', fontSize: 13, marginTop: 8 },
  input: {
    backgroundColor: '#183552',
    borderWidth: 1,
    borderColor: '#2a4a6b',
    borderRadius: 8,
    color: '#f4f7fb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: '#ff8a80', marginTop: 8 },
  button: {
    marginTop: 20,
    backgroundColor: '#e8eef5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#0f2744', fontWeight: '700', fontSize: 16 },
});
