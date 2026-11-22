import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { useTappedNotification } from '@/lib/notifications';
import { StoreProvider } from '@/lib/store';

/** 期限の通知をタップしたら、その書類の要点を開く */
function OpenFromNotification() {
  const tapped = useTappedNotification();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!tapped || handled.current === tapped.id) return;
    handled.current = tapped.id;
    router.push(`/doc/${tapped.docId}`);
  }, [tapped]);
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StoreProvider>
        {Platform.OS !== 'web' && <OpenFromNotification />}
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
