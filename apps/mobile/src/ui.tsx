import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ShaderSurface } from './shaders/ShaderSurface';
import type { LookName } from './shaders/looks';
import { font, useTheme } from './theme';

export const GOLD = ['#f4dc9f', '#dcb76c', '#b98f45'] as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_SPRING = { damping: 18, stiffness: 340 };

/** A pressable that gives under the finger. Reduced-motion settings are honoured by Reanimated. */
export function PressScale({
  style,
  children,
  ...rest
}: Omit<ComponentProps<typeof Pressable>, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={() => {
        scale.value = withSpring(0.97, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      style={[style, pressed]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Eases a list item into place, one after another for the first few on screen. */
export function Rise({ index = 0, children }: { index?: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(index < 6 ? index * 55 : 0)}>
      {children}
    </Animated.View>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      {children}
    </View>
  );
}

/** A headline card cast in liquid metal. The veil keeps text readable over its highlights. */
export function MetalCard({ look, children }: { look: LookName; children: ReactNode }) {
  const t = useTheme();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return (
    <View style={[styles.metal, { borderColor: t.border }]}>
      <ShaderSurface look={look} animated={focused} />
      <View style={styles.veil} />
      <View style={styles.metalBody}>{children}</View>
    </View>
  );
}

/** A club's badge until licensed crests exist: its short name on its kit colour. */
export function ClubCrest({
  shortName,
  colour,
  size = 52,
}: {
  shortName: string;
  colour: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.crest,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colour },
      ]}
    >
      <Text style={[styles.crestText, { fontSize: size * 0.27 }]}>{shortName}</Text>
    </View>
  );
}

/** A thin gold gauge, for how full something is. */
export function Gauge({ share }: { share: number }) {
  const t = useTheme();
  return (
    <View style={[styles.gauge, { backgroundColor: t.border }]}>
      <View
        style={[
          styles.gaugeFill,
          { backgroundColor: t.accent, width: `${Math.round(Math.min(1, share) * 100)}%` },
        ]}
      />
    </View>
  );
}

export function Chip({ label, tone }: { label: string; tone: 'done' | 'todo' | 'live' | 'muted' }) {
  const t = useTheme();
  const colour = { done: t.accent, todo: t.todo, live: t.live, muted: t.muted }[tone];
  return (
    <View style={[styles.chip, { borderColor: colour }]}>
      <Text style={[styles.chipText, { color: colour }]}>{label}</Text>
    </View>
  );
}

/** A bar of the page yet to come, with a gold light passing over it. */
function Shimmer({ height, width = '100%' }: { height: number; width?: `${number}%` }) {
  const x = useSharedValue(-1);
  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1500 }), -1);
  }, [x]);
  const pass = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 320 }] }));
  return (
    <View style={[styles.shimmer, { height, width }]}>
      <Animated.View style={[styles.shimmerLight, pass]}>
        <LinearGradient
          colors={['transparent', 'rgba(220, 183, 108, 0.2)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Shimmer height={12} width="38%" />
          <Shimmer height={22} width="72%" />
          <Shimmer height={46} />
        </View>
      ))}
    </View>
  );
}

/** A whole number that counts up to its value, for coins arriving. */
export function CountUp({ value, style }: { value: number; style?: StyleProp<TextStyle> }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(shown);
  useEffect(() => {
    const start = from.current;
    if (reduced || start === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const began = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - began) / 800);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(start + (value - start) * eased);
      from.current = next;
      setShown(next);
      if (progress === 1) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [reduced, value]);
  return (
    <Text style={style} accessibilityLabel={value.toLocaleString('en-US')}>
      {shown.toLocaleString('en-US')}
    </Text>
  );
}

/** A card cut like a ticket: details above a torn line, what to do below it. */
export function Ticket({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.ticket, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.ticketPart}>{top}</View>
      <View style={styles.tear}>
        <View style={[styles.notch, styles.notchLeft, { borderColor: t.border }]} />
        <View style={[styles.tearLine, { borderColor: t.border }]} />
        <View style={[styles.notch, styles.notchRight, { borderColor: t.border }]} />
      </View>
      <View style={styles.ticketPart}>{bottom}</View>
    </View>
  );
}

export function Message({ title, body }: { title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: t.muted }]}>{body}</Text> : null}
    </View>
  );
}

const GOLD_EDGE = 'rgba(255, 240, 200, 0.55)';

export function Button({
  label,
  onPress,
  disabled,
  busy,
  kind = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  kind?: 'primary' | 'secondary';
}) {
  const t = useTheme();
  const primary = kind === 'primary';
  const off = disabled || busy;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: primary && off ? t.border : 'transparent',
          borderColor: primary ? (off ? 'transparent' : GOLD_EDGE) : off ? t.border : t.accent,
        },
      ]}
    >
      {primary && !off ? (
        <LinearGradient
          colors={GOLD}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {busy ? (
        <ActivityIndicator color={primary ? t.accentText : t.accent} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: primary ? (off ? t.muted : t.accentText) : off ? t.muted : t.accent },
          ]}
        >
          {label}
        </Text>
      )}
    </PressScale>
  );
}

/** Two or more options side by side, one selected. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { borderColor: t.border, backgroundColor: t.surface }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && { backgroundColor: t.accent }]}
          >
            <Text style={[styles.segmentText, { color: on ? t.accentText : t.text }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.sectionTitle, { color: t.accent }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, paddingTop: 16 },
  shimmer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 10,
  },
  shimmerLight: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 200 },
  ticket: { borderWidth: 1, borderRadius: 16, marginHorizontal: 16, marginBottom: 12 },
  ticketPart: { padding: 16 },
  tear: { height: 18, justifyContent: 'center' },
  tearLine: { borderTopWidth: 1, borderStyle: 'dashed', marginHorizontal: 14 },
  notch: {
    position: 'absolute',
    top: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: '#07080b',
  },
  notchLeft: { left: -9 },
  notchRight: { right: -9 },
  crest: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.34)',
  },
  crestText: { color: '#ffffff', fontFamily: font.heavy, letterSpacing: 0.3 },
  gauge: { height: 4, borderRadius: 2, overflow: 'hidden' },
  gaugeFill: { height: 4, borderRadius: 2 },
  metal: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#14100a',
  },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 5, 7, 0.58)' },
  metalBody: { padding: 18 },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 46,
    overflow: 'hidden',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontFamily: font.title },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentText: { fontSize: 13, fontFamily: font.title },
  sectionTitle: {
    fontSize: 12,
    fontFamily: font.title,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  screen: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 12, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 17, fontFamily: font.title, textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
