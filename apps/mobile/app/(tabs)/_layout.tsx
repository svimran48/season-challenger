import { Tabs } from 'expo-router';
import { TabBar } from '../../src/TabBar';
import { font, useTheme } from '../../src/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: t.solid },
        headerTintColor: t.text,
        headerTitleStyle: { fontFamily: font.display, fontSize: 20 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Matches' }} />
      <Tabs.Screen name="mastery" options={{ title: 'Mastery' }} />
      <Tabs.Screen name="leagues" options={{ title: 'Tournaments' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
