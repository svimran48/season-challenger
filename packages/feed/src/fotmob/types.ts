/**
 * The parts of FotMob's public site API (`/api/data/...`) the adapter reads. Every field is
 * optional: FotMob adds and renames fields between seasons, and the adapter treats a missing
 * field as "not reported" rather than as an error.
 */

export interface FotMobLeagueResponse {
  details?: {
    id?: number;
    name?: string;
    shortName?: string;
    country?: string;
    selectedSeason?: string;
    latestSeason?: string;
    leagueColor?: string;
  };
  allAvailableSeasons?: string[];
  /** One table per group (some competitions split into stages); most leagues have a single one. */
  table?: FotMobTableGroup[] | { data?: { table?: { all?: FotMobTableRow[] } } };
  fixtures?: {
    allMatches?: FotMobMatch[];
    firstUnplayedMatch?: FotMobMatch | null;
  };
}

export interface FotMobTableGroup {
  data?: { table?: { all?: FotMobTableRow[] } };
}

export interface FotMobTableRow {
  id?: string | number;
  name?: string;
  shortName?: string;
}

export interface FotMobTeamRef {
  id?: string | number;
  name?: string;
  shortName?: string;
  score?: number;
}

export interface FotMobMatchStatus {
  utcTime?: string;
  started?: boolean;
  finished?: boolean;
  cancelled?: boolean;
  awarded?: boolean;
  scoreStr?: string;
  reason?: { short?: string; shortKey?: string; long?: string };
}

export interface FotMobMatch {
  id?: string | number;
  round?: string | number | null;
  roundName?: string | number | null;
  home?: FotMobTeamRef;
  away?: FotMobTeamRef;
  status?: FotMobMatchStatus;
}

export interface FotMobTeamResponse {
  details?: {
    id?: number;
    name?: string;
    shortName?: string;
    country?: string;
    latestSeason?: string;
  };
  overview?: {
    teamColors?: { lightMode?: string; darkMode?: string };
  };
  squad?: {
    squad?: FotMobSquadGroup[];
  };
}

export interface FotMobSquadGroup {
  title?: string;
  members?: FotMobSquadMember[];
}

export interface FotMobSquadMember {
  id?: string | number;
  name?: string;
  /** Detailed positions, primary first: "RB,CB", "CDM,CM", "ST,LW", "GK". */
  positionIdsDesc?: string;
  role?: { key?: string; fallback?: string };
  /** Market value in euros; the source of a player's credit price. */
  transferValue?: number | null;
  rating?: number | null;
  excludeFromRanking?: boolean;
}

export interface FotMobStatValue {
  title?: string;
  key?: string;
  /** [home, away] for team stats. */
  stats?: (number | string)[];
  rawStats?: { value?: number | string }[];
}

export interface FotMobTeamStatGroup {
  title?: string;
  key?: string;
  stats?: FotMobStatValue[];
}

export interface FotMobMatchDetails {
  general?: {
    matchId?: string;
    leagueId?: number;
    leagueName?: string;
    matchRound?: string;
    matchTimeUTCDate?: string;
    homeTeam?: FotMobTeamRef;
    awayTeam?: FotMobTeamRef;
  };
  header?: {
    teams?: FotMobTeamRef[];
    status?: FotMobMatchStatus;
  };
  content?: {
    stats?: { Periods?: { All?: { stats?: FotMobTeamStatGroup[] } } } | null;
    playerStats?: Record<string, FotMobPlayerMatch> | null;
    lineup?: {
      homeTeam?: FotMobLineup;
      awayTeam?: FotMobLineup;
    } | null;
    matchFacts?: {
      events?: { events?: FotMobEvent[] };
    };
  };
}

export interface FotMobLineup {
  starters?: FotMobLineupPlayer[];
  subs?: FotMobLineupPlayer[];
}

export interface FotMobLineupPlayer {
  id?: string | number;
  name?: string;
}

export interface FotMobPlayerStatGroup {
  key?: string;
  stats?: Record<string, { key?: string; stat?: { value?: number | string } }>;
}

export interface FotMobPlayerMatch {
  id?: number;
  name?: string;
  teamId?: number;
  isGoalkeeper?: boolean;
  stats?: FotMobPlayerStatGroup[];
}

export interface FotMobEvent {
  type?: string;
  time?: number | null;
  overloadTime?: number | null;
  isHome?: boolean;
  playerId?: string | number | null;
  card?: string | null;
  ownGoal?: unknown;
  /** "HT" on the half-time marker, "FT" on the full-time marker. */
  halfStrShort?: string;
  homeScore?: number;
  awayScore?: number;
  shotmapEvent?: { isOwnGoal?: boolean };
}
