import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { StoreProvider } from '@/lib/store';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StoreProvider>
        <Stack screenOptions={{ headerBackTitle: '戻る' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="import" options={{ title: '書類を取り込む', presentation: 'modal' }} />
          <Stack.Screen name="doc/[id]" options={{ title: '要点' }} />
          <Stack.Screen name="diff/[id]" options={{ title: '前の版との違い' }} />
        </Stack>
      </StoreProvider>
    </ThemeProvider>
  );
}
