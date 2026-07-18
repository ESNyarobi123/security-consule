import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { ready, token } = useAuth();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0f2744',
        }}
      >
        <ActivityIndicator color="#e8eef5" />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(app)" />;
  }
  return <Redirect href="/login" />;
}
