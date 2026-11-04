import { DEFAULT_SQUAD_RULES, validateSquad, type Player, type Position } from '@season/shared';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api';
import { countdown, formatCoins } from '../../src/format';
import { RewardMoment } from '../../src/RewardMoment';
import { SquadPitch } from '../../src/SquadPitch';
import { font, useTheme } from '../../src/theme';
import { Button, ClubCrest, Loading, Message, Screen, Segmented } from '../../src/ui';

const ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

export default function SquadScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { contestId } = useLocalSearchParams<{ contestId: string }>();
  const contest = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => api.contest(contestId),
  });
  const fixtureId = contest.data?.fixtureId;
  const fixture = useQuery({
    queryKey: ['fixture', fixtureId],
    queryFn: () => api.fixture(fixtureId!),
    enabled: !!fixtureId,
  });
  const [picked, setPicked] = useState<string[]>([]);
  const [captainId, setCaptain] = useState<string>();
  const [viceId, setVice] = useState<string>();
  const [tab, setTab] = useState<Position>('GK');
  const [joined, setJoined] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  const join = useMutation({
    mutationFn: () =>
      api.join(contestId, { playerIds: picked, captainId: captainId!, viceCaptainId: viceId! }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      setJoined(true);
    },
  });

  const players = fixture.data?.players ?? [];
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const rules = DEFAULT_SQUAD_RULES;
  const chosen = picked.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  const count = (pos: Position) => chosen.filter((p) => p.position === pos).length;
  const credits = Math.round(chosen.reduce((s, p) => s + p.credits, 0) * 10) / 10;
  const check =
    fixture.data && captainId && viceId
      ? validateSquad(
          { fixtureId: fixture.data.id, playerIds: picked, captainId, viceCaptainId: viceId },
          players,
        )
      : undefined;

  if (contest.isError || fixture.isError) return <Message title="Couldn't load this tournament" />;
  if (!contest.data || !fixture.data) return <Loading />;
  const c = contest.data;
  const f = fixture.data;
  if (c.status !== 'open' || f.status !== 'scheduled') {
    return <Message title="Entries are closed" body="This match has kicked off." />;
  }

  const toggle = (p: Player) => {
    if (picked.includes(p.id)) {
      setPicked(picked.filter((id) => id !== p.id));
      if (captainId === p.id) setCaptain(undefined);
      if (viceId === p.id) setVice(undefined);
    } else if (picked.length < rules.size && count(p.position) < rules.positions[p.position][1]) {
      setPicked([...picked, p.id]);
    }
  };
  const clubOf = (p: Player) => (p.clubId === f.homeClubId ? f.home : f.away);

  const status =
    picked.length < rules.size
      ? `Pick ${rules.size - picked.length} more`
      : !captainId || !viceId
        ? 'Choose a captain (C) and vice-captain (VC)'
        : check && !check.valid
          ? check.errors[0]!.message.replace(f.homeClubId, f.home.name).replace(
              f.awayClubId,
              f.away.name,
            )
          : 'Ready';

  return (
    <Screen>
      <Stack.Screen options={{ title: `${f.home.shortName} v ${f.away.shortName}` }} />
      <View style={[styles.summary, { backgroundColor: t.solid }]}>
        <View style={{ flexShrink: 1 }}>
          <Text style={[styles.heading, { color: t.text }]} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
            Top prize {formatCoins(c.topPrize)} · locks in {countdown(f.kickoffAt)}
          </Text>
        </View>
        <Text
          style={[styles.credits, { color: credits > rules.maxCredits ? t.live : t.accent }]}
          accessibilityLabel={`${credits} of ${rules.maxCredits} credits used`}
        >
          {credits}
          <Text style={[styles.creditsOf, { color: t.muted }]}> / {rules.maxCredits} cr</Text>
        </Text>
      </View>
      <SquadPitch
        chosen={chosen}
        rules={rules}
        height={Math.max(184, Math.round(windowHeight * 0.29))}
        colourOf={(p) => clubOf(p).colour}
        captainId={captainId}
        viceId={viceId}
        onRemove={toggle}
        onGap={setTab}
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={ORDER.map((pos) => {
          const [min, max] = rules.positions[pos];
          return {
            value: pos,
            label: `${pos} ${count(pos)}/${min === max ? min : `${min}-${max}`}`,
          };
        })}
      />
      <FlatList
        style={{ flex: 1 }}
        data={players.filter((p) => p.position === tab).sort((a, b) => b.credits - a.credits)}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => {
          const on = picked.includes(item.id);
          const club = clubOf(item);
          return (
            <Pressable
              onPress={() => toggle(item)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[
                styles.player,
                {
                  borderColor: on ? t.accent : t.border,
                  backgroundColor: on ? 'rgba(220, 183, 108, 0.12)' : t.surface,
                },
              ]}
            >
              <ClubCrest shortName={club.shortName} colour={club.colour} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 15 }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.price, { color: t.accent }]}>
                  {item.credits.toFixed(1)} cr
                </Text>
              </View>
              {on ? (
                <View style={styles.roles}>
                  {(['C', 'VC'] as const).map((role) => {
                    const active = role === 'C' ? captainId === item.id : viceId === item.id;
                    return (
                      <Pressable
                        key={role}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Make ${item.name} ${role === 'C' ? 'captain' : 'vice-captain'}`}
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          if (role === 'C') {
                            setCaptain(item.id);
                            if (viceId === item.id) setVice(undefined);
                          } else {
                            setVice(item.id);
                            if (captainId === item.id) setCaptain(undefined);
                          }
                        }}
                        style={[
                          styles.role,
                          {
                            borderColor: t.accent,
                            backgroundColor: active ? t.accent : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={[styles.roleText, { color: active ? t.accentText : t.accent }]}
                        >
                          {role}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Ionicons name="add-circle-outline" size={24} color={t.muted} />
              )}
            </Pressable>
          );
        }}
      />
      <View
        style={[
          styles.footer,
          { backgroundColor: t.solid, borderColor: t.border, paddingBottom: bottom + 12 },
        ]}
      >
        <Text style={{ color: join.error ? t.live : t.muted, marginBottom: 8 }} numberOfLines={2}>
          {join.error instanceof ApiError
            ? join.error.code === 'contest_full'
              ? 'This tournament just filled up. Go back and pick another.'
              : join.error.message
            : status}
        </Text>
        <Button
          label={`Join for ${formatCoins(c.entryFee)}`}
          disabled={!check?.valid}
          busy={join.isPending}
          onPress={() => join.mutate()}
        />
      </View>
      <RewardMoment
        visible={joined}
        title="You're in"
        detail={`${c.name}, ${f.home.name} v ${f.away.name}. Your squad locks at kick-off.`}
        onClose={() => {
          setJoined(false);
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  heading: { fontSize: 16, fontFamily: font.title },
  credits: { fontSize: 20, fontFamily: font.display },
  creditsOf: { fontSize: 12, fontFamily: font.title },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 54,
  },
  price: { fontSize: 12, fontFamily: font.title, marginTop: 1 },
  roles: { flexDirection: 'row', gap: 6 },
  role: {
    borderWidth: 1,
    borderRadius: 999,
    minWidth: 36,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: { fontSize: 12, fontFamily: font.display },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
