import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShaderSurface } from './shaders/ShaderSurface';
import { font, useTheme } from './theme';
import { Button, CountUp } from './ui';

/** A full-screen beat of gold light after something worth marking: a win, an entry, a claim. */
export function RewardMoment({
  visible,
  title,
  coins,
  detail,
  onClose,
}: {
  visible: boolean;
  title: string;
  /** Coins just earned. Leave out when nothing was paid, such as joining a tournament. */
  coins?: number;
  detail?: string;
  onClose: () => void;
}) {
  const t = useTheme();
  const { bottom } = useSafeAreaInsets();
  useEffect(() => {
    if (!visible) return;
    // Not every device has a vibration motor, and the moment works without one.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root} accessibilityViewIsModal>
        <ShaderSurface look="burst" />
        <Animated.View entering={ZoomIn.duration(420)} style={styles.body}>
          {coins ? (
            <View style={styles.amount}>
              <Text style={[styles.plus, { color: t.text }]}>+</Text>
              <CountUp value={coins} style={[styles.coins, { color: t.text }]} />
            </View>
          ) : (
            <Ionicons name="checkmark-circle" size={84} color={t.text} />
          )}
          {coins ? <Text style={[styles.unit, { color: t.text }]}>COINS</Text> : null}
          <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
            {title}
          </Text>
          {detail ? <Text style={[styles.detail, { color: t.text }]}>{detail}</Text> : null}
        </Animated.View>
        <View style={[styles.footer, { paddingBottom: bottom + 24 }]}>
          <Button label="Continue" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const shade = { textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowRadius: 12 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121315' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  amount: { flexDirection: 'row', alignItems: 'baseline' },
  plus: { fontSize: 44, fontFamily: font.display },
  coins: { fontSize: 76, fontFamily: font.heavy, fontVariant: ['tabular-nums'], ...shade },
  unit: { fontSize: 13, fontFamily: font.title, letterSpacing: 4, ...shade },
  title: { fontSize: 28, fontFamily: font.heavy, textAlign: 'center', marginTop: 18, ...shade },
  detail: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
    ...shade,
  },
  footer: { paddingHorizontal: 24 },
});
