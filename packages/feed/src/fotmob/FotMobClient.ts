export interface FotMobClientOptions {
  baseUrl?: string;
  /** Injected in tests; defaults to the global fetch. */
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  /** Attempts per request, including the first. */
  retries?: number;
  userAgent?: string;
}

interface CacheEntry {
  expiresAt: number;
  value: Promise<unknown>;
}

const DEFAULT_BASE_URL = 'https://www.fotmob.com';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/131.0.0.0 Safari/537.36';

/**
 * A small caching JSON client for FotMob's public site API. Responses are cached by URL for a
 * caller-chosen time, and concurrent requests for the same URL share one fetch, so a page view
 * cannot turn into a burst of upstream calls.
 */
export class FotMobClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly userAgent: string;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: FotMobClientOptions = {}) {
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) throw new Error('No fetch implementation is available.');
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.retries = Math.max(1, options.retries ?? 2);
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  }

  /** Fetch and parse JSON, reusing a cached response while it is fresh. */
  async json<T>(
    path: string,
    query: Readonly<Record<string, string | number | undefined>> = {},
    ttlMs = 0,
  ): Promise<T> {
    const url = this.url(path, query);
    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > this.now().getTime()) return cached.value as Promise<T>;

    const value = this.request<T>(url);
    // A failed request is not cached, so the next caller retries instead of inheriting the error.
    if (ttlMs > 0) {
      const entry: CacheEntry = { expiresAt: this.now().getTime() + ttlMs, value };
      this.cache.set(url, entry);
      value.catch(() => {
        if (this.cache.get(url) === entry) this.cache.delete(url);
      });
    }
    return value;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private url(path: string, query: Readonly<Record<string, string | number | undefined>>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const search = params.toString();
    return `${this.baseUrl}${path}${search ? `?${search}` : ''}`;
  }

  private async request<T>(url: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      try {
        return await this.once<T>(url);
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === this.retries) break;
        await sleep(250 * attempt);
      }
    }
    throw lastError;
  }

  private async once<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new HttpError(response.status, url);
      const body = await response.text();
      try {
        return JSON.parse(body) as T;
      } catch {
        // A challenge page or an error document arrives as HTML with a 200.
        throw new Error(`FotMob returned a non-JSON body for ${url}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`FotMob request failed with ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

const isRetryable = (error: unknown): boolean => {
  if (error instanceof HttpError) return error.status === 429 || error.status >= 500;
  // A network error or an aborted timeout is worth one more try.
  return error instanceof TypeError || (error instanceof Error && error.name === 'AbortError');
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
