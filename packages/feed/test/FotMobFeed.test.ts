import { describe, expect, it } from 'vitest';
import { FotMobFeed } from '../src';
import { FINAL_SNAPSHOT_VERSION, creditsFor, snapshotVersion } from '../src/fotmob/map';
import type { FotMobMatchDetails } from '../src/fotmob/types';

const league = {
  details: {
    id: 47,
    name: 'Test League',
    selectedSeason: '2026/2027',
    latestSeason: '2026/2027',
  },
  allAvailableSeasons: ['2026/2027', '2025/2026'],
  table: [
    {
      data: {
        table: {
          all: [
            { id: '1', name: 'Alpha FC', shortName: 'ALP' },
            { id: '2', name: 'Beta FC', shortName: 'BET' },
          ],
        },
      },
    },
  ],
  fixtures: {
    allMatches: [
      {
        id: 'm1',
        round: '1',
        roundName: 1,
        home: { id: '1', name: 'Alpha FC', shortName: 'ALP' },
        away: { id: '2', name: 'Beta FC', shortName: 'BET' },
        status: {
          utcTime: '2026-08-15T14:00:00Z',
          started: true,
          finished: true,
          reason: { shortKey: 'fulltime_short' },
        },
      },
      {
        id: 'm2',
        round: '2',
        roundName: 2,
        home: { id: '2', name: 'Beta FC' },
        away: { id: '1', name: 'Alpha FC' },
        status: { utcTime: '2026-09-01T14:00:00Z', started: false, finished: false },
      },
    ],
  },
};

const teams: Record<string, unknown> = {
  1: {
    overview: { teamColors: { lightMode: '#123456' } },
    squad: {
      squad: [
        { title: 'coach', members: [{ id: 99, name: 'The Coach', role: { key: 'coach' } }] },
        {
          title: 'keepers',
          members: [
            { id: 11, name: 'Keeper One', positionIdsDesc: 'GK', transferValue: 1_000_000 },
          ],
        },
        { title: 'defenders', members: [{ id: 12, name: 'Defender One', positionIdsDesc: 'CB' }] },
        {
          title: 'midfielders',
          members: [
            { id: 13, name: 'Mid One', positionIdsDesc: 'CDM,CM', transferValue: 50_000_000 },
          ],
        },
        {
          title: 'attackers',
          members: [
            { id: 14, name: 'Forward One', positionIdsDesc: 'ST,LW', transferValue: 80_000_000 },
          ],
        },
      ],
    },
  },
  2: {
    overview: { teamColors: { lightMode: '#abc' } },
    squad: {
      squad: [
        { title: 'keepers', members: [{ id: 21, name: 'Keeper Two', positionIdsDesc: 'GK' }] },
        { title: 'defenders', members: [{ id: 22, name: 'Defender Two', positionIdsDesc: 'LB' }] },
      ],
    },
  },
};

const matchDetails: FotMobMatchDetails = {
  general: { matchId: 'm1', leagueId: 47, homeTeam: { id: 1 }, awayTeam: { id: 2 } },
  header: {
    teams: [
      { id: 1, name: 'Alpha FC', score: 2 },
      { id: 2, name: 'Beta FC', score: 1 },
    ],
    status: { utcTime: '2026-08-15T14:00:00Z', started: true, finished: true },
  },
  content: {
    stats: {
      Periods: {
        All: {
          stats: [
            {
              title: 'Top stats',
              key: 'top_stats',
              stats: [
                { key: 'BallPossesion', stats: [61, 39] },
                { key: 'total_shots', stats: [15, 9] },
                { key: 'ShotsOnTarget', stats: [7, 4] },
                { key: 'corners', stats: [6, 3] },
              ],
            },
          ],
        },
      },
    },
    playerStats: {
      11: {
        id: 11,
        name: 'Keeper One',
        teamId: 1,
        isGoalkeeper: true,
        stats: [
          {
            key: 'top_stats',
            stats: {
              minutes: { key: 'minutes_played', stat: { value: 90 } },
              conceded: { key: 'goals_conceded', stat: { value: 1 } },
              saves: { key: 'saves', stat: { value: 4 } },
            },
          },
        ],
      },
      12: {
        id: 12,
        name: 'Defender One',
        teamId: 1,
        stats: [
          {
            key: 'top_stats',
            stats: {
              minutes: { key: 'minutes_played', stat: { value: 90 } },
              tackles: { key: 'matchstats.headers.tackles', stat: { value: 3 } },
            },
          },
        ],
      },
      14: {
        id: 14,
        name: 'Forward One',
        teamId: 1,
        stats: [
          {
            key: 'top_stats',
            stats: {
              minutes: { key: 'minutes_played', stat: { value: 30 } },
              goals: { key: 'goals', stat: { value: 1 } },
            },
          },
        ],
      },
      22: {
        id: 22,
        name: 'Defender Two',
        teamId: 2,
        stats: [
          {
            key: 'top_stats',
            stats: {
              minutes: { key: 'minutes_played', stat: { value: 90 } },
              dribbles: { key: 'dribbles_succeeded', stat: { value: 2 } },
            },
          },
        ],
      },
    },
    lineup: {
      homeTeam: { starters: [{ id: 11 }, { id: 12 }, { id: 14 }], subs: [{ id: 13 }] },
      awayTeam: { starters: [{ id: 22 }], subs: [] },
    },
    matchFacts: {
      events: {
        events: [
          { type: 'Goal', time: 20, isHome: true, playerId: 14, ownGoal: null },
          { type: 'Half', time: 45, halfStrShort: 'HT', homeScore: 1, awayScore: 0 },
          { type: 'Goal', time: 70, isHome: false, playerId: 22, ownGoal: true },
          { type: 'Goal', time: 80, isHome: true, playerId: 13, ownGoal: null },
          { type: 'Card', time: 30, isHome: true, playerId: 12, card: 'Yellow' },
          { type: 'Card', time: 88, isHome: false, playerId: 22, card: 'Red' },
          { type: 'Half', time: 90, halfStrShort: 'FT', homeScore: 2, awayScore: 1 },
        ],
      },
    },
  },
};

const route = (url: URL): unknown => {
  if (url.pathname === '/api/data/leagues') return league;
  if (url.pathname === '/api/data/teams') return teams[url.searchParams.get('id') ?? ''];
  if (url.pathname === '/api/data/matchDetails') return matchDetails;
  return undefined;
};

function fakeFetch(routes: (url: URL) => unknown = route) {
  const calls: string[] = [];
  const impl = (async (input: unknown) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    const body = routes(url);
    if (body === undefined) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const makeFeed = (now = '2026-08-20T12:00:00Z') => {
  const { impl, calls } = fakeFetch();
  const feed = new FotMobFeed({ fetch: impl, now: () => new Date(now) });
  return { feed, calls };
};

describe('FotMobFeed', () => {
  it('reads the season from the league page', async () => {
    const { feed } = makeFeed();
    expect(await feed.getSeason()).toEqual({
      id: 'fm-season-47-2026-2027',
      competition: 'Test League',
      startsOn: '2026-08-15',
      endsOn: '2026-09-01',
      gameweeks: 2,
    });
  });

  it('builds clubs from the table, with kit colours from the club page', async () => {
    const { feed } = makeFeed();
    const clubs = await feed.listClubs();
    expect(clubs[0]).toEqual({
      id: 'fm-club-1',
      name: 'Alpha FC',
      shortName: 'ALP',
      colour: '#123456',
    });
    // "#abc" is not a six-digit colour, so the deterministic fallback is used.
    expect(clubs[1]).toMatchObject({
      id: 'fm-club-2',
      colour: expect.stringMatching(/^#[0-9a-f]{6}$/),
    });
  });

  it('maps squad positions and prices, and skips the coaching staff', async () => {
    const { feed } = makeFeed();
    const players = await feed.listPlayers(['fm-club-1']);
    expect(players.map((p) => `${p.name}:${p.position}`)).toEqual([
      'Keeper One:GK',
      'Defender One:DEF',
      'Mid One:MID',
      'Forward One:FWD',
    ]);
    for (const player of players) {
      expect(player.credits).toBeGreaterThanOrEqual(4);
      expect(player.credits).toBeLessThanOrEqual(12);
      expect((player.credits * 2) % 1).toBe(0);
    }
    const byName = (name: string) => players.find((p) => p.name === name)!;
    expect(byName('Forward One').credits).toBeGreaterThan(byName('Keeper One').credits);
  });

  it('prices a position band from market value', () => {
    expect(creditsFor('FWD', null)).toBe(8.5);
    expect(creditsFor('FWD', 100_000)).toBe(5);
    expect(creditsFor('FWD', 200_000_000)).toBe(12);
    expect(creditsFor('FWD', 80_000_000)).toBeGreaterThan(creditsFor('FWD', 1_000_000));
  });

  it('maps fixture status and supports the filters', async () => {
    const { feed } = makeFeed();
    const fixtures = await feed.listFixtures();
    expect(fixtures).toHaveLength(2);
    expect(fixtures[0]).toMatchObject({
      id: 'fm-fixture-m1',
      gameweek: 1,
      homeClubId: 'fm-club-1',
      awayClubId: 'fm-club-2',
      status: 'finished',
    });
    expect(fixtures[1]!.status).toBe('scheduled');
    expect(await feed.listFixtures({ status: 'scheduled' })).toHaveLength(1);
    expect(await feed.listFixtures({ gameweek: 1 })).toHaveLength(1);
    expect((await feed.getFixture('fm-fixture-m2'))?.status).toBe('scheduled');
  });

  it('builds a final snapshot from the match page', async () => {
    const { feed } = makeFeed();
    const stats = await feed.getStats('fm-fixture-m1');
    expect(stats).toBeDefined();
    expect(stats!.version).toBe(FINAL_SNAPSHOT_VERSION);
    expect(stats!.isFinal).toBe(true);
    expect(stats!.home).toEqual({
      clubId: 'fm-club-1',
      goals: 2,
      halfTimeGoals: 1,
      shots: 15,
      shotsOnTarget: 7,
      possession: 61,
      corners: 6,
    });
    expect(stats!.away).toMatchObject({ goals: 1, halfTimeGoals: 0, possession: 39 });

    const byId = new Map(stats!.players.map((p) => [p.playerId, p]));
    expect(byId.get('fm-player-11')).toMatchObject({ goalsConceded: 1, saves: 4 });
    const defender = byId.get('fm-player-12')!;
    expect(defender.tackles).toBe(3);
    // FotMob reports no goals conceded for outfield players; the side conceded one.
    expect(defender.goalsConceded).toBe(1);
    expect(defender.yellowCards).toBe(1);
    // A 30-minute cameo shares the one goal conceded.
    expect(byId.get('fm-player-14')!.goalsConceded).toBe(0);
    expect(byId.get('fm-player-22')).toMatchObject({
      goalsConceded: 2,
      ownGoals: 1,
      redCards: 1,
      dribbles: 2,
    });
    // Named on the bench and never used, but still has a line.
    expect(byId.get('fm-player-13')!.minutes).toBe(0);
  });

  it('has no snapshot before kickoff, and caches upstream responses', async () => {
    const { feed, calls } = makeFeed();
    expect(await feed.getStats('fm-fixture-m2')).toBeUndefined();
    expect(calls.filter((c) => c.startsWith('/api/data/matchDetails'))).toHaveLength(0);
    await feed.listFixtures();
    await feed.listFixtures();
    expect(calls.filter((c) => c.startsWith('/api/data/leagues'))).toHaveLength(1);
  });

  it('falls back to a season that has fixtures', async () => {
    const empty = {
      ...league,
      fixtures: { allMatches: [] },
      details: { ...league.details, selectedSeason: '2026/2027' },
    };
    const previous = { ...league, details: { ...league.details, selectedSeason: '2025/2026' } };
    const { impl } = fakeFetch((url) => {
      if (url.pathname !== '/api/data/leagues') return route(url);
      return url.searchParams.get('season') === '2025/2026' ? previous : empty;
    });
    const feed = new FotMobFeed({ fetch: impl, season: '2026/2027' });
    expect((await feed.getSeason()).id).toBe('fm-season-47-2025-2026');
  });

  it('derives live snapshot versions from the clock', () => {
    const status = { utcTime: '2026-08-15T14:00:00Z', started: true };
    expect(snapshotVersion(status, new Date('2026-08-15T14:37:00Z'))).toBe(37);
    expect(snapshotVersion({ ...status, finished: true }, new Date('2026-08-15T16:00:00Z'))).toBe(
      FINAL_SNAPSHOT_VERSION,
    );
  });
});
