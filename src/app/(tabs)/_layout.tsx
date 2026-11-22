import { Tabs } from 'expo-router/js-tabs';
import { Text, type ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ fontSize: 18, color }}>{glyph}</Text>;
  };

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.accent }}>
      <Tabs.Screen name="index" options={{ title: 'ホーム', tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="tasks" options={{ title: 'やること', tabBarIcon: icon('✓') }} />
      <Tabs.Screen name="documents" options={{ title: '書類一覧', tabBarIcon: icon('☰') }} />
    </Tabs>
  );
}
