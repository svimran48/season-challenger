import type {
  Fixture,
  FixtureStatus,
  Player,
  PlayerMatchStats,
  Position,
  TeamMatchStats,
} from '@season/shared';
import type {
  FotMobEvent,
  FotMobLineup,
  FotMobMatch,
  FotMobMatchDetails,
  FotMobMatchStatus,
  FotMobPlayerMatch,
  FotMobSquadGroup,
  FotMobSquadMember,
  FotMobTeamStatGroup,
} from './types';

/*
 * Pure translations from FotMob's response shapes into the domain types. Kept free of I/O so the
 * mapping can be tested against recorded payloads.
 */

export const CLUB_ID_PREFIX = 'fm-club-';
export const PLAYER_ID_PREFIX = 'fm-player-';
export const FIXTURE_ID_PREFIX = 'fm-fixture-';

/** The version a finished match's stats snapshot is stored under. Live snapshots count up to it. */
export const FINAL_SNAPSHOT_VERSION = 1000;

export const fotmobClubId = (id: string | number) => `${CLUB_ID_PREFIX}${id}`;
export const fotmobPlayerId = (id: string | number) => `${PLAYER_ID_PREFIX}${id}`;
export const fotmobFixtureId = (id: string | number) => `${FIXTURE_ID_PREFIX}${id}`;
export const fotmobSeasonId = (leagueId: number, season: string) =>
  `fm-season-${leagueId}-${season.replace(/\//g, '-')}`;

/** The provider id back out of one of our ids. */
export const providerId = (id: string, prefix: string) => id.slice(prefix.length);

const POSITION_BY_CODE: Readonly<Record<string, Position>> = {
  GK: 'GK',
  K: 'GK',
  GOALKEEPER: 'GK',
  CB: 'DEF',
  LB: 'DEF',
  RB: 'DEF',
  LWB: 'DEF',
  RWB: 'DEF',
  SW: 'DEF',
  DEF: 'DEF',
  DF: 'DEF',
  CDM: 'MID',
  DM: 'MID',
  CM: 'MID',
  CAM: 'MID',
  AM: 'MID',
  LM: 'MID',
  RM: 'MID',
  MID: 'MID',
  MF: 'MID',
  ST: 'FWD',
  CF: 'FWD',
  LW: 'FWD',
  RW: 'FWD',
  LF: 'FWD',
  RF: 'FWD',
  FW: 'FWD',
  FWD: 'FWD',
  ATT: 'FWD',
};

const POSITION_BY_GROUP: Readonly<Record<string, Position>> = {
  KEEPERS: 'GK',
  GOALKEEPERS: 'GK',
  DEFENDERS: 'DEF',
  DEFENCE: 'DEF',
  DEFENSE: 'DEF',
  MIDFIELDERS: 'MID',
  MIDFIELD: 'MID',
  ATTACKERS: 'FWD',
  FORWARDS: 'FWD',
  ATTACK: 'FWD',
};

/** A squad player's position: the first listed position code, else the squad group. */
export function positionOf(member: FotMobSquadMember, groupTitle?: string): Position {
  const first = member.positionIdsDesc?.split(',')[0]?.trim().toUpperCase();
  if (first && POSITION_BY_CODE[first]) return POSITION_BY_CODE[first]!;
  const group = groupTitle?.trim().toUpperCase();
  if (group && POSITION_BY_GROUP[group]) return POSITION_BY_GROUP[group]!;
  return 'MID';
}

/** Squad building price per position, in credits. */
export const CREDIT_RANGE: Readonly<Record<Position, readonly [number, number]>> = {
  GK: [4, 7],
  DEF: [4, 7.5],
  MID: [4.5, 11],
  FWD: [5, 12],
};

/** Market values run from about €100k to €160M; the price curve spans that range. */
const MARKET_VALUE_LOG_MIN = 5;
const MARKET_VALUE_LOG_MAX = 8.2;

const roundHalf = (n: number) => Math.round(n * 2) / 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Prices a player from their market value on a log scale inside the position's band, so a
 * €90M forward costs more than a €5M one without ever leaving the band. A fixed formula, not a
 * pool-relative one, so a player's price does not move when other clubs sync.
 */
export function creditsFor(position: Position, marketValue?: number | null): number {
  const [lo, hi] = CREDIT_RANGE[position];
  if (!marketValue || marketValue <= 0) return roundHalf((lo + hi) / 2);
  const span = MARKET_VALUE_LOG_MAX - MARKET_VALUE_LOG_MIN;
  const t = clamp((Math.log10(marketValue) - MARKET_VALUE_LOG_MIN) / span, 0, 1);
  return clamp(roundHalf(lo + t * (hi - lo)), lo, hi);
}

/** A stable club colour for teams whose page carries none, so the app never shows a blank. */
export function colourFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const lightness = 0.32 + ((hash >>> 9) % 12) / 100;
  const [r, g, b] = hslToRgb(hue / 360, 0.55, lightness);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((c) => Math.round(c * 255)) as [
    number,
    number,
    number,
  ];
}

/** Live becomes finished becomes scheduled, in the order FotMob reports them. */
export function fixtureStatus(status: FotMobMatch['status']): FixtureStatus {
  if (!status) return 'scheduled';
  if (status.cancelled) return 'finished';
  if (status.finished) return 'finished';
  if (status.started) return 'live';
  return 'scheduled';
}

export function toFixture(match: FotMobMatch, seasonId: string): Fixture | undefined {
  const id = match.id;
  const home = match.home?.id;
  const away = match.away?.id;
  const kickoffAt = match.status?.utcTime;
  if (id === undefined || home === undefined || away === undefined || !kickoffAt) return undefined;
  const round = Number(match.roundName ?? match.round);
  return {
    id: fotmobFixtureId(id),
    seasonId,
    gameweek: Number.isFinite(round) && round > 0 ? Math.trunc(round) : 1,
    homeClubId: fotmobClubId(home),
    awayClubId: fotmobClubId(away),
    kickoffAt,
    status: fixtureStatus(match.status),
  };
}

export interface SquadPlayer extends Player {
  marketValue?: number | null;
}

/** Every member of a squad except the coaching staff. */
export function squadPlayers(
  clubId: string,
  groups: readonly FotMobSquadGroup[] | undefined,
): SquadPlayer[] {
  const players: SquadPlayer[] = [];
  for (const group of groups ?? []) {
    const title = group.title?.toLowerCase();
    if (title === 'coach' || title === 'staff') continue;
    for (const member of group.members ?? []) {
      if (member.id === undefined || !member.name) continue;
      if (member.role?.key === 'coach') continue;
      const position = positionOf(member, group.title);
      players.push({
        id: fotmobPlayerId(member.id),
        clubId,
        name: member.name,
        position,
        credits: creditsFor(position, member.transferValue),
        marketValue: member.transferValue ?? null,
      });
    }
  }
  return players;
}

const num = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const numericId = (value: string | number | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const id = Number(value);
  return Number.isFinite(id) ? id : undefined;
};

/** Team stats arrive grouped by section; flatten to `key -> [home, away]`. */
export function flattenTeamStats(
  groups: readonly FotMobTeamStatGroup[] | undefined,
): Map<string, [number, number]> {
  const stats = new Map<string, [number, number]>();
  for (const group of groups ?? []) {
    for (const item of group.stats ?? []) {
      const key = item.key;
      if (!key || stats.has(key)) continue;
      const values = item.stats ?? item.rawStats?.map((r) => r.value);
      const home = num(values?.[0]);
      const away = num(values?.[1]);
      stats.set(key, [home, away]);
    }
  }
  return stats;
}

function stat(stats: Map<string, [number, number]>, ...keys: string[]): [number, number] {
  for (const key of keys) {
    const value = stats.get(key);
    if (value) return value;
  }
  return [0, 0];
}

/** Player stats arrive grouped by section; flatten to `key -> value`. */
export function flattenPlayerStats(player: FotMobPlayerMatch): Map<string, number> {
  const stats = new Map<string, number>();
  for (const group of player.stats ?? []) {
    for (const entry of Object.values(group.stats ?? {})) {
      const key = entry.key;
      if (!key || stats.has(key)) continue;
      stats.set(key, num(entry.stat?.value));
    }
  }
  return stats;
}

const playerStat = (stats: Map<string, number>, ...keys: string[]) => {
  for (const key of keys) {
    const value = stats.get(key);
    if (value !== undefined) return value;
  }
  return 0;
};

/** A stat FotMob may omit entirely, as distinct from one it reports as zero. */
const playerStatMaybe = (stats: Map<string, number>, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = stats.get(key);
    if (value !== undefined) return value;
  }
  return undefined;
};

interface CardTally {
  yellow: number;
  red: number;
}

function cardsByPlayer(events: readonly FotMobEvent[]): Map<string, CardTally> {
  const cards = new Map<string, CardTally>();
  for (const event of events) {
    if (event.type !== 'Card' || event.playerId === undefined || event.playerId === null) continue;
    const id = String(event.playerId);
    const tally = cards.get(id) ?? { yellow: 0, red: 0 };
    const card = (event.card ?? '').toLowerCase();
    // A second yellow is a sending off, counted as a red rather than a second yellow.
    if (card === 'yellowred' || card === 'red') tally.red += 1;
    else if (card === 'yellow') tally.yellow += 1;
    cards.set(id, tally);
  }
  return cards;
}

function ownGoalsByPlayer(events: readonly FotMobEvent[]): Map<string, number> {
  const goals = new Map<string, number>();
  for (const event of events) {
    if (event.type !== 'Goal') continue;
    const isOwn = Boolean(event.ownGoal) || event.shotmapEvent?.isOwnGoal === true;
    if (!isOwn || event.playerId === undefined || event.playerId === null) continue;
    const id = String(event.playerId);
    goals.set(id, (goals.get(id) ?? 0) + 1);
  }
  return goals;
}

function halfTimeScore(events: readonly FotMobEvent[]): [number, number] | undefined {
  const marker = events.find((e) => e.type === 'Half' && e.halfStrShort === 'HT');
  if (marker) return [num(marker.homeScore), num(marker.awayScore)];
  return undefined;
}

function goalsBeforeHalf(events: readonly FotMobEvent[]): [number, number] {
  let home = 0;
  let away = 0;
  for (const event of events) {
    if (event.type !== 'Goal') continue;
    const minute = num(event.time) + num(event.overloadTime);
    if (minute > 45) continue;
    if (event.isHome) home += 1;
    else away += 1;
  }
  return [home, away];
}

export interface MatchStats {
  home: TeamMatchStats;
  away: TeamMatchStats;
  players: PlayerMatchStats[];
}

export interface MatchStatsInput {
  details: FotMobMatchDetails;
  homeClubId: string;
  awayClubId: string;
}

/**
 * Builds a stats snapshot from a match page. Players who were named but did not get on the pitch
 * are included with zero minutes, so a squad submission always has a line for every pick.
 */
export function toMatchStats({ details, homeClubId, awayClubId }: MatchStatsInput): MatchStats {
  const content = details.content;
  const events = content?.matchFacts?.events?.events ?? [];
  const teamStats = flattenTeamStats(content?.stats?.Periods?.All?.stats);

  const scores = details.header?.teams ?? [];
  const homeGoals = num(scores[0]?.score);
  const awayGoals = num(scores[1]?.score);
  const halfTime = halfTimeScore(events) ?? goalsBeforeHalf(events);

  const possession = stat(teamStats, 'BallPossesion', 'ball_possession', 'Possession');
  const homePossession = possession[0] || (possession[1] ? 100 - possession[1] : 50);
  const shots = stat(teamStats, 'total_shots', 'shots');
  const onTarget = stat(teamStats, 'ShotsOnTarget', 'shots_on_target');
  const corners = stat(teamStats, 'corners', 'Corners');

  const home: TeamMatchStats = {
    clubId: homeClubId,
    goals: homeGoals,
    halfTimeGoals: halfTime[0],
    shots: shots[0],
    shotsOnTarget: onTarget[0],
    possession: homePossession,
    corners: corners[0],
  };
  const away: TeamMatchStats = {
    clubId: awayClubId,
    goals: awayGoals,
    halfTimeGoals: halfTime[1],
    shots: shots[1],
    shotsOnTarget: onTarget[1],
    possession: 100 - homePossession,
    corners: corners[1],
  };

  const cards = cardsByPlayer(events);
  const ownGoals = ownGoalsByPlayer(events);
  const teamOf = new Map<number, string>();
  const lineups: [FotMobLineup | undefined, string][] = [
    [content?.lineup?.homeTeam, homeClubId],
    [content?.lineup?.awayTeam, awayClubId],
  ];
  for (const [lineup, clubId] of lineups) {
    for (const player of [...(lineup?.starters ?? []), ...(lineup?.subs ?? [])]) {
      if (player.id !== undefined) teamOf.set(Number(player.id), clubId);
    }
  }

  // FotMob reports goals conceded only for keepers. For everyone else, charge the opponent's
  // goals in proportion to the minutes they were on the pitch, or a defender would look like
  // they kept a clean sheet in a match their side lost.
  const homeTeamId = numericId(details.general?.homeTeam?.id ?? details.header?.teams?.[0]?.id);
  const awayTeamId = numericId(details.general?.awayTeam?.id ?? details.header?.teams?.[1]?.id);
  const concededFor = (
    teamId: number | undefined,
    minutes: number,
    reported: number | undefined,
  ) => {
    if (reported !== undefined) return reported;
    if (teamId === undefined) return 0;
    const against = teamId === homeTeamId ? awayGoals : teamId === awayTeamId ? homeGoals : 0;
    return Math.round((against * Math.min(minutes, 90)) / 90);
  };

  const players: PlayerMatchStats[] = [];
  const seen = new Set<string>();
  for (const [key, player] of Object.entries(content?.playerStats ?? {})) {
    const rawId = player.id ?? Number(key);
    if (!Number.isFinite(rawId)) continue;
    const id = fotmobPlayerId(rawId);
    seen.add(id);
    const stats = flattenPlayerStats(player);
    const tally = cards.get(String(rawId)) ?? { yellow: 0, red: 0 };
    const minutes = playerStat(stats, 'minutes_played', 'minutes');
    players.push({
      playerId: id,
      minutes,
      goals: playerStat(stats, 'goals'),
      assists: playerStat(stats, 'assists'),
      goalsConceded: concededFor(player.teamId, minutes, playerStatMaybe(stats, 'goals_conceded')),
      saves: playerStat(stats, 'saves'),
      penaltiesSaved: playerStat(stats, 'penalties_saved', 'penalty_saved'),
      penaltiesMissed: playerStat(stats, 'penalties_missed', 'penalty_missed'),
      ownGoals: ownGoals.get(String(rawId)) ?? 0,
      yellowCards: tally.yellow,
      redCards: tally.red,
      tackles: playerStat(stats, 'matchstats.headers.tackles', 'tackles'),
      dribbles: playerStat(stats, 'dribbles_succeeded', 'successful_dribbles'),
    });
  }

  // Named in a lineup but not in the player stats: an unused substitute, or a player who came on
  // too late for FotMob to record a stat line.
  for (const [rawId, clubId] of teamOf) {
    const id = fotmobPlayerId(rawId);
    if (seen.has(id)) continue;
    if (clubId !== homeClubId && clubId !== awayClubId) continue;
    seen.add(id);
    const tally = cards.get(String(rawId)) ?? { yellow: 0, red: 0 };
    players.push({
      playerId: id,
      minutes: 0,
      goals: 0,
      assists: 0,
      goalsConceded: 0,
      saves: 0,
      penaltiesSaved: 0,
      penaltiesMissed: 0,
      ownGoals: ownGoals.get(String(rawId)) ?? 0,
      yellowCards: tally.yellow,
      redCards: tally.red,
      tackles: 0,
      dribbles: 0,
    });
  }

  return { home, away, players };
}

/** Elapsed minutes for a live snapshot's version; finished matches use the final version. */
export function snapshotVersion(status: FotMobMatchStatus | undefined, now: Date): number {
  if (!status || status.finished || status.cancelled) return FINAL_SNAPSHOT_VERSION;
  const kickoff = status.utcTime ? Date.parse(status.utcTime) : Number.NaN;
  if (!Number.isFinite(kickoff)) return 1;
  const minutes = Math.floor((now.getTime() - kickoff) / 60_000);
  return clamp(minutes, 0, FINAL_SNAPSHOT_VERSION - 1);
}
