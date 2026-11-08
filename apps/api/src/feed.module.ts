import { Module, type DynamicModule } from '@nestjs/common';
import { FakeFeed, FotMobFeed, type FootballFeed } from '@season/feed';
import { DATABASE, FEED_SYNC, FOOTBALL_FEED } from './common/tokens';
import type { Database } from './db/client';
import { FeedSync } from './feed/feed-sync';
import { PgFeed } from './feed/pg-feed';

export function createFeed(
  kind = process.env.FOOTBALL_FEED ?? 'fake',
  env: NodeJS.ProcessEnv = process.env,
): FootballFeed {
  switch (kind) {
    case 'fake':
      return new FakeFeed();
    case 'fotmob':
      return new FotMobFeed({
        leagueId: leagueIdFrom(env.FOTMOB_LEAGUE_ID),
        season: env.FOTMOB_SEASON || undefined,
      });
    default:
      throw new Error(`Unknown FOOTBALL_FEED "${kind}". Supported: fake, fotmob.`);
  }
}

function leagueIdFrom(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`FOTMOB_LEAGUE_ID must be a FotMob league id, got "${value}".`);
  }
  return id;
}

@Module({})
export class FeedModule {
  /** With a database, the API reads synced tables and only the sync talks to the provider. */
  static register(upstream: FootballFeed = createFeed(), db?: Database): DynamicModule {
    const providers = db
      ? [
          { provide: DATABASE, useValue: db },
          { provide: FOOTBALL_FEED, useValue: new PgFeed(db, upstream.name) },
          { provide: FEED_SYNC, useValue: new FeedSync(db, upstream) },
        ]
      : [
          { provide: DATABASE, useValue: undefined },
          { provide: FOOTBALL_FEED, useValue: upstream },
          { provide: FEED_SYNC, useValue: undefined },
        ];
    return {
      module: FeedModule,
      global: true,
      providers,
      exports: [DATABASE, FOOTBALL_FEED, FEED_SYNC],
    };
  }
}
