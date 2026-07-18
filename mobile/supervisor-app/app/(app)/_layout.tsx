import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { SiteDutyProvider } from '@/hooks/useSiteDuty';

export default function AppLayout() {
  const { ready, token } = useAuth();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f2f5f8',
        }}
      >
        <ActivityIndicator color="#0f2744" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <SiteDutyProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f2744' },
          headerTintColor: '#f4f7fb',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#f2f5f8' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Live board' }} />
        <Stack.Screen name="alerts" options={{ title: 'Field alerts' }} />
        <Stack.Screen name="attendance" options={{ title: 'Attendance' }} />
        <Stack.Screen name="incidents" options={{ title: 'Incidents' }} />
        <Stack.Screen name="eob" options={{ title: 'Occurrence book' }} />
      </Stack>
    </SiteDutyProvider>
  );
}
