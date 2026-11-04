import type { Player, Position } from '@season/shared';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ShaderSurface } from './shaders/ShaderSurface';
import { font, useTheme } from './theme';

type Rules = { size: number; positions: Record<Position, readonly [number, number]> };

const ROWS: Position[] = ['FWD', 'MID', 'DEF', 'GK'];
const SPARE_ORDER: Position[] = ['DEF', 'MID', 'FWD'];

/** How many places to draw in each line: what is picked, what is required, then a usual shape. */
function placesFor(chosen: Player[], rules: Rules): Record<Position, number> {
  const count = (pos: Position) => chosen.filter((p) => p.position === pos).length;
  const places = {} as Record<Position, number>;
  for (const pos of ROWS) places[pos] = Math.max(count(pos), rules.positions[pos][0]);
  let spare = rules.size - ROWS.reduce((sum, pos) => sum + places[pos], 0);
  for (let i = 0; spare > 0 && i < SPARE_ORDER.length * rules.size; i++) {
    const pos = SPARE_ORDER[i % SPARE_ORDER.length]!;
    if (places[pos] < rules.positions[pos][1]) {
      places[pos] += 1;
      spare -= 1;
    }
  }
  return places;
}

const surname = (name: string) => name.split(' ').at(-1) ?? name;

/** The squad taking shape on grass. Tap a player to take them off, or a gap to pick for it. */
export function SquadPitch({
  chosen,
  rules,
  height,
  colourOf,
  captainId,
  viceId,
  onRemove,
  onGap,
}: {
  chosen: Player[];
  rules: Rules;
  height: number;
  colourOf: (player: Player) => string;
  captainId?: string;
  viceId?: string;
  onRemove: (player: Player) => void;
  onGap: (position: Position) => void;
}) {
  const t = useTheme();
  const places = placesFor(chosen, rules);
  return (
    <View style={[styles.pitch, { height, borderColor: t.border }]}>
      <ShaderSurface look="pitch" animated={false} />
      <View style={styles.rows}>
        {ROWS.map((pos) => {
          const line = chosen.filter((p) => p.position === pos);
          const gaps = Math.max(0, places[pos] - line.length);
          return (
            <View key={pos} style={styles.row}>
              {line.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${p.name}`}
                  onPress={() => onRemove(p)}
                  style={styles.place}
                >
                  <View style={[styles.disc, { backgroundColor: colourOf(p) }]}>
                    <Text style={styles.discText}>{p.credits.toFixed(1)}</Text>
                  </View>
                  {p.id === captainId || p.id === viceId ? (
                    <View style={[styles.badge, { backgroundColor: t.accent }]}>
                      <Text style={[styles.badgeText, { color: t.accentText }]}>
                        {p.id === captainId ? 'C' : 'VC'}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.name} numberOfLines={1}>
                    {surname(p.name)}
                  </Text>
                </Pressable>
              ))}
              {Array.from({ length: gaps }, (_, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Pick a ${pos}`}
                  onPress={() => onGap(pos)}
                  style={styles.place}
                >
                  <View style={styles.gap}>
                    <Ionicons name="add" size={16} color="rgba(255, 255, 255, 0.72)" />
                  </View>
                  <Text style={styles.gapText}>{pos}</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pitch: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#07150e',
  },
  rows: { flex: 1, justifyContent: 'space-around', paddingVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'center' },
  place: { width: 62, alignItems: 'center' },
  disc: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discText: { color: '#ffffff', fontSize: 10, fontFamily: font.display },
  badge: {
    position: 'absolute',
    top: -3,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 9, fontFamily: font.heavy },
  name: { color: '#ffffff', fontSize: 10, fontFamily: font.title, marginTop: 2, maxWidth: 60 },
  gap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapText: { color: 'rgba(255, 255, 255, 0.62)', fontSize: 10, marginTop: 2 },
});
