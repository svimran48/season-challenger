import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Tabs } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, useTheme } from './theme';
import { GOLD } from './ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['football-outline', 'football'],
  mastery: ['analytics-outline', 'analytics'],
  leagues: ['trophy-outline', 'trophy'],
  wallet: ['wallet-outline', 'wallet'],
  profile: ['person-outline', 'person'],
};

/** A floating bar on the silk, with a gold pill that slides to the open tab. */
export function TabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const t = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slot = width / state.routes.length;
  const x = useSharedValue(0);
  const measured = useRef(false);
  useEffect(() => {
    if (slot === 0) return;
    // The first placement is not a move, so the pill starts on the open tab without sliding.
    x.value = measured.current
      ? withSpring(state.index * slot, { damping: 20, stiffness: 240 })
      : state.index * slot;
    measured.current = true;
  }, [slot, state.index, x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.wrap, { paddingBottom: bottom + 10 }]}>
      <View
        style={[styles.bar, { backgroundColor: t.solid, borderColor: t.border }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width - 2)}
      >
        {slot > 0 ? (
          <Animated.View style={[styles.pill, { width: slot - 8 }, slide]}>
            <LinearGradient
              colors={GOLD}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        {state.routes.map((route, index) => {
          const active = state.index === index;
          const colour = active ? t.accentText : t.muted;
          const title = descriptors[route.key]?.options.title ?? route.name;
          const [outline, filled] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={title}
              style={styles.tab}
              onPress={() => {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!active && !event.defaultPrevented) navigateToTab(route.key);
              }}
            >
              <Ionicons name={active ? filled : outline} size={21} color={colour} />
              <Text style={[styles.label, { color: colour }]} numberOfLines={1}>
                {title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingTop: 8, backgroundColor: 'transparent' },
  bar: {
    flexDirection: 'row',
    height: 62,
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 17,
    overflow: 'hidden',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 10, fontFamily: font.title },
});
