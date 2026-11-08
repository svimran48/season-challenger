import type { Club, Fixture, Player, Season, StatsSnapshot } from '@season/shared';
import type { FixtureFilter, FootballFeed } from '../FootballFeed';
import { FotMobClient } from './FotMobClient';
import {
  CLUB_ID_PREFIX,
  FIXTURE_ID_PREFIX,
  colourFor,
  fotmobClubId,
  fotmobSeasonId,
  providerId,
  snapshotVersion,
  squadPlayers,
  toFixture,
  toMatchStats,
} from './map';
import type {
  FotMobLeagueResponse,
  FotMobMatchDetails,
  FotMobTableGroup,
  FotMobTeamResponse,
} from './types';

/** FotMob's id for the Premier League. */
export const PREMIER_LEAGUE_ID = 47;

export interface FotMobFeedOptions {
  leagueId?: number;
  /** A season as FotMob writes it, e.g. "2026/2027". Defaults to the season FotMob treats as current. */
  season?: string;
  baseUrl?: string;
  /** Injected in tests; defaults to the global fetch. */
  fetch?: typeof fetch;
  now?: () => Date;
  /** How long the league response (table and fixtures) is reused, in ms. */
  leagueTtlMs?: number;
  /** How long a club page (squad and kit colour) is reused, in ms. */
  clubTtlMs?: number;
  /** How long a finished match's stats are reused, in ms. */
  statsTtlMs?: number;
  /** How long a live match's stats are reused, in ms. */
  liveTtlMs?: number;
  /** Club and match pages fetched in parallel. */
  concurrency?: number;
  timeoutMs?: number;
}

interface ClubRef {
  id: string;
  name: string;
  shortName: string;
}

interface ResolvedLeague {
  payload: FotMobLeagueResponse;
  season: string;
}

interface League {
  season: Season;
  clubs: ClubRef[];
  fixtures: Fixture[];
}

/**
 * A `FootballFeed` backed by FotMob's public site API (the endpoints the website calls). It reads
 * one league for one season: table and fixtures from the league page, squads and kit colours from
 * each club page, and per-match stats from the match page.
 *
 * The API is unofficial and unversioned, so every field is read defensively and mapping lives in
 * `map.ts`, where it can be tested without the network. Point `leagueId` and `season` at whichever
 * competition the game should run on.
 */
export class FotMobFeed implements FootballFeed {
  readonly name = 'fotmob';

  private readonly client: FotMobClient;
  private readonly now: () => Date;
  private readonly leagueId: number;
  private readonly seasonOption: string | undefined;
  private readonly leagueTtlMs: number;
  private readonly clubTtlMs: number;
  private readonly statsTtlMs: number;
  private readonly liveTtlMs: number;
  private readonly concurrency: number;

  constructor(options: FotMobFeedOptions = {}) {
    this.client = new FotMobClient({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      now: options.now,
      timeoutMs: options.timeoutMs,
    });
    this.now = options.now ?? (() => new Date());
    this.leagueId = options.leagueId ?? PREMIER_LEAGUE_ID;
    this.seasonOption = options.season;
    this.leagueTtlMs = options.leagueTtlMs ?? 30_000;
    this.clubTtlMs = options.clubTtlMs ?? 6 * 60 * 60 * 1000;
    this.statsTtlMs = options.statsTtlMs ?? 24 * 60 * 60 * 1000;
    this.liveTtlMs = options.liveTtlMs ?? 15_000;
    this.concurrency = Math.max(1, options.concurrency ?? 4);
  }

  async getSeason(): Promise<Season> {
    return (await this.league()).season;
  }

  async listClubs(): Promise<Club[]> {
    const { clubs } = await this.league();
    return mapLimit(clubs, this.concurrency, (ref) => this.toClub(ref));
  }

  async listPlayers(clubIds?: readonly string[]): Promise<Player[]> {
    const { clubs } = await this.league();
    const requested = clubIds?.map((id) => providerId(id, CLUB_ID_PREFIX));
    const refs: ClubRef[] =
      requested?.map((id) => clubs.find((c) => c.id === id) ?? { id, name: id, shortName: id }) ??
      clubs;
    if (refs.length === 0) return [];
    const squads = await mapLimit(refs, this.concurrency, async (ref) => {
      const page = await this.clubPage(ref.id);
      return squadPlayers(fotmobClubId(ref.id), page.squad?.squad);
    });
    return squads.flat();
  }

  async listFixtures(filter: FixtureFilter = {}): Promise<Fixture[]> {
    const { fixtures } = await this.league();
    return this.filter(fixtures, filter);
  }

  async getFixture(fixtureId: string): Promise<Fixture | undefined> {
    const { fixtures } = await this.league();
    return fixtures.find((f) => f.id === fixtureId);
  }

  async getStats(fixtureId: string): Promise<StatsSnapshot | undefined> {
    const { fixtures } = await this.league();
    const fixture = fixtures.find((f) => f.id === fixtureId);
    if (!fixture) return undefined;
    // Before kickoff there is nothing to grade, so the feed reports no snapshot rather than zeros.
    if (fixture.status === 'scheduled') return undefined;

    const matchId = providerId(fixtureId, FIXTURE_ID_PREFIX);
    const ttl = fixture.status === 'finished' ? this.statsTtlMs : this.liveTtlMs;
    const details = await this.client.json<FotMobMatchDetails>(
      '/api/data/matchDetails',
      { matchId },
      ttl,
    );
    if (!details.header?.status?.started) return undefined;
    const status = details.header.status;
    return {
      fixtureId,
      version: snapshotVersion(status, this.now()),
      isFinal: Boolean(status.finished || status.cancelled),
      ...toMatchStats({ details, homeClubId: fixture.homeClubId, awayClubId: fixture.awayClubId }),
    };
  }

  private filter(fixtures: readonly Fixture[], filter: FixtureFilter): Fixture[] {
    return fixtures.filter(
      (f) =>
        (filter.gameweek === undefined || f.gameweek === filter.gameweek) &&
        (filter.status === undefined || f.status === filter.status),
    );
  }

  private async toClub(ref: ClubRef): Promise<Club> {
    const page = await this.clubPage(ref.id).catch(() => undefined);
    const colour = page && kitColour(page);
    return {
      id: fotmobClubId(ref.id),
      name: ref.name,
      shortName: ref.shortName,
      colour: colour ?? colourFor(ref.id),
    };
  }

  private clubPage(teamId: string): Promise<FotMobTeamResponse> {
    return this.client.json<FotMobTeamResponse>('/api/data/teams', { id: teamId }, this.clubTtlMs);
  }

  private async league(): Promise<League> {
    const { payload, season } = await this.resolveLeague();
    const seasonId = fotmobSeasonId(this.leagueId, season);
    const fixtures = (payload.fixtures?.allMatches ?? [])
      .map((match) => toFixture(match, seasonId))
      .filter((f): f is Fixture => f !== undefined)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt) || a.id.localeCompare(b.id));
    const clubs = clubRefs(payload);
    return {
      season: {
        id: seasonId,
        competition: payload.details?.name ?? `FotMob league ${this.leagueId}`,
        ...seasonBounds(fixtures, this.now()),
        gameweeks: fixtures.reduce((max, f) => Math.max(max, f.gameweek), 0) || 1,
      },
      clubs,
      fixtures,
    };
  }

  /**
   * The season the feed serves. FotMob's default season occasionally has no fixtures yet (the
   * week before a new campaign), so fall back to the newest season that does, rather than
   * handing the game an empty league.
   */
  private async resolveLeague(): Promise<ResolvedLeague> {
    const first = await this.leaguePage(this.seasonOption);
    const season =
      this.seasonOption ?? first.details?.selectedSeason ?? first.details?.latestSeason;
    if (!season) {
      throw new Error(`FotMob returned no season for league ${this.leagueId}.`);
    }
    if (hasMatches(first)) return { payload: first, season };

    for (const candidate of (first.allAvailableSeasons ?? []).slice(0, 3)) {
      if (candidate === season) continue;
      const page = await this.leaguePage(candidate);
      if (hasMatches(page)) return { payload: page, season: candidate };
    }
    return { payload: first, season };
  }

  private leaguePage(season: string | undefined): Promise<FotMobLeagueResponse> {
    return this.client.json<FotMobLeagueResponse>(
      '/api/data/leagues',
      { id: this.leagueId, season },
      this.leagueTtlMs,
    );
  }
}

const hasMatches = (payload: FotMobLeagueResponse) =>
  (payload.fixtures?.allMatches ?? []).length > 0;

const kitColour = (page: FotMobTeamResponse): string | undefined => {
  const colour = page.overview?.teamColors?.lightMode ?? page.overview?.teamColors?.darkMode;
  return colour && /^#[0-9a-f]{6}$/i.test(colour) ? colour : undefined;
};

/** Clubs in table order, with any club that only appears in the fixture list appended. */
function clubRefs(payload: FotMobLeagueResponse): ClubRef[] {
  const refs = new Map<string, ClubRef>();
  const add = (id: string | number | undefined, name?: string, shortName?: string) => {
    if (id === undefined) return;
    const key = String(id);
    if (!key || refs.has(key)) return;
    refs.set(key, { id: key, name: name ?? `Club ${key}`, shortName: shortName ?? name ?? key });
  };

  for (const group of tableGroups(payload)) {
    for (const row of group.data?.table?.all ?? []) add(row.id, row.name, row.shortName);
  }
  for (const match of payload.fixtures?.allMatches ?? []) {
    add(match.home?.id, match.home?.name, match.home?.shortName);
    add(match.away?.id, match.away?.name, match.away?.shortName);
  }
  return [...refs.values()];
}

function tableGroups(payload: FotMobLeagueResponse): FotMobTableGroup[] {
  const table = payload.table;
  if (!table) return [];
  return Array.isArray(table) ? table : [{ data: table.data }];
}

/** Season dates from the fixture list, padded around today if the league has no fixtures yet. */
function seasonBounds(
  fixtures: readonly Fixture[],
  now: Date,
): Pick<Season, 'startsOn' | 'endsOn'> {
  const kickoffs = fixtures
    .map((f) => Date.parse(f.kickoffAt))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  const first = kickoffs[0];
  const last = kickoffs[kickoffs.length - 1];
  if (first === undefined || last === undefined) {
    const today = now.toISOString().slice(0, 10);
    return { startsOn: today, endsOn: today };
  }
  return {
    startsOn: new Date(first).toISOString().slice(0, 10),
    endsOn: new Date(last).toISOString().slice(0, 10),
  };
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}
