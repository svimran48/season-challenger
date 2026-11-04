import { TIERS, TIER_THRESHOLDS, type Tier } from '@season/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { font, useTheme } from '../../src/theme';
import type { LookName } from '../../src/shaders/looks';
import { ShaderSurface } from '../../src/shaders/ShaderSurface';
import { Card, Chip, Gauge, Loading, MetalCard, Message, Screen } from '../../src/ui';

export default function MasteryScreen() {
  const t = useTheme();
  const mine = useQuery({ queryKey: ['mastery', 'me'], queryFn: api.myMastery });
  const board = useQuery({ queryKey: ['mastery', 'leaderboard'], queryFn: api.masteryLeaderboard });

  if (mine.isError) return <Message title="Couldn't load your Season Mastery" />;
  if (!mine.data) return <Loading />;
  const { rating, tier, cardsCompleted, cardsForLeaderboard, next, history } = mine.data;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <MetalCard look={tier as LookName}>
          <View style={styles.spread}>
            <Text style={[styles.label, { color: t.text }]}>Season rating</Text>
            <Chip label={tier} tone="done" />
          </View>
          <Text style={[styles.rating, { color: t.text }]}>{Math.round(rating)}</Text>
          {next ? (
            <>
              <Gauge share={next.share} />
              <Text style={[styles.note, { color: t.text }]}>
                {next.next} needs rating {next.rating.need} and {next.cards.need} cards. You have{' '}
                {cardsCompleted}.
              </Text>
            </>
          ) : (
            <Text style={{ color: t.text }}>You hold the top tier.</Text>
          )}
          {cardsCompleted < cardsForLeaderboard ? (
            <Text style={[styles.note, { color: t.text }]}>
              {cardsCompleted} of {cardsForLeaderboard} cards needed to join the season leaderboard.
            </Text>
          ) : null}
        </MetalCard>

        <Card>
          <Text style={[styles.heading, { color: t.text }]}>Your matches</Text>
          {history.length === 0 ? (
            <Text style={[styles.body, { color: t.muted }]}>
              No graded cards yet. Open an upcoming match and answer its analysis card before
              kick-off.
            </Text>
          ) : (
            history.map((h) => (
              <Link
                key={h.fixtureId}
                href={{ pathname: '/card/[fixtureId]', params: { fixtureId: h.fixtureId } }}
                asChild
              >
                <Pressable accessibilityRole="link" style={[styles.row, { borderColor: t.border }]}>
                  <Text style={{ color: t.text }}>
                    {h.home} v {h.away}
                  </Text>
                  <Text style={[styles.score, { color: t.text }]}>{Math.round(h.score)}</Text>
                </Pressable>
              </Link>
            ))
          )}
        </Card>

        <Card>
          <Text style={[styles.heading, { color: t.text }]}>Season leaderboard</Text>
          {board.isError ? (
            <Text style={{ color: t.muted }}>Couldn't load the leaderboard.</Text>
          ) : !board.data ? (
            <Text style={{ color: t.muted }}>Loading…</Text>
          ) : board.data.entries.length === 0 ? (
            <Text style={[styles.body, { color: t.muted }]}>
              Nobody has {board.data.minCards} graded cards yet.
            </Text>
          ) : (
            board.data.entries.map((e) => (
              <View key={e.rank + e.displayName} style={[styles.row, { borderColor: t.border }]}>
                <View style={styles.who}>
                  <View
                    style={[
                      styles.medal,
                      { borderColor: MEDALS[e.rank - 1] ?? t.border },
                      MEDALS[e.rank - 1] ? { backgroundColor: MEDALS[e.rank - 1] } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.medalText,
                        { color: MEDALS[e.rank - 1] ? t.accentText : t.muted },
                      ]}
                    >
                      {e.rank}
                    </Text>
                  </View>
                  <Text
                    style={{ color: e.isYou ? t.accent : t.text, flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {e.displayName}
                    {e.isYou ? ' (you)' : ''}
                  </Text>
                </View>
                <Text style={{ color: t.muted }}>
                  {e.tier} · {Math.round(e.rating)}
                </Text>
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={[styles.heading, { color: t.text }]}>How Season Mastery works</Text>
          <Text style={[styles.body, { color: t.muted }]}>
            Before each match, answer an analysis card of 5 to 8 calls: the result and how sure you
            are, shot ranges, who leads at half time, key player battles. After full time every call
            is graded against the real match stats. Calls that go against the crowd count for more.
          </Text>
        </Card>

        <Card>
          <Text style={[styles.heading, { color: t.text }]}>Tiers</Text>
          {TIERS.map((name, index) => {
            const need = TIER_THRESHOLDS[name];
            const here = name === tier;
            const reached = index <= TIERS.indexOf(tier as Tier);
            return (
              <View
                key={name}
                style={[
                  styles.rung,
                  { borderColor: here ? t.accent : 'transparent', opacity: reached ? 1 : 0.55 },
                ]}
              >
                <View style={styles.swatch}>
                  <ShaderSurface look={name as LookName} animated={false} seed={9 + index * 5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierName, { color: t.text }]}>{name}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>
                    {need.cards === 0
                      ? 'Where everyone starts'
                      : `Rating ${need.rating}+, ${need.cards} cards`}
                  </Text>
                </View>
                {here ? <Chip label="You" tone="done" /> : null}
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const MEDALS = ['#dcb76c', '#c3c9d1', '#b57f52'];

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  medal: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: { fontSize: 12, fontFamily: font.display },
  rung: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 14,
  },
  swatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: '#14100a',
  },
  content: { paddingTop: 16 },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, fontFamily: font.title, textTransform: 'uppercase', letterSpacing: 1.6 },
  rating: { fontSize: 48, fontFamily: font.heavy, marginVertical: 4 },
  note: { marginTop: 8 },
  heading: { fontSize: 17, fontFamily: font.title, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  score: { fontFamily: font.display, fontVariant: ['tabular-nums'] },
  tierName: { fontSize: 15, fontFamily: font.title },
});
