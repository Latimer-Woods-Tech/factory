import { InternalError, ValidationError } from '@factory/errors';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** @internal Looser fetch signature compatible with vi.fn mocks. */
type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function apiRequest<T>(
  url: string,
  init: RequestInit,
  fetchImpl: FetchFn,
): Promise<T> {
  const res = await fetchImpl(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new InternalError(`Social API request failed (${String(res.status)}): ${text}`, {
      url,
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// X / Twitter API v2
// ---------------------------------------------------------------------------

/**
 * Credentials required to authenticate with the X/Twitter API v2.
 */
export interface TwitterConfig {
  /** OAuth 2.0 Bearer Token (App-only auth). */
  bearerToken: string;
}

/** @internal */
export interface TwitterDeps {
  fetch?: FetchFn;
}

/** Represents a single tweet object returned by the X API. */
export interface Tweet {
  id: string;
  text: string;
}

/** Represents a summarised tweet in a user's timeline. */
export interface TimelineTweet {
  id: string;
  text: string;
  authorId: string;
}

const TWITTER_BASE = 'https://api.twitter.com/2';

/**
 * Posts a new tweet.
 *
 * @example
 * ```ts
 * const tweet = await postTweet(config, 'Hello, world!');
 * console.log(tweet.id);
 * ```
 */
export async function postTweet(
  config: TwitterConfig,
  text: string,
  deps: TwitterDeps = {},
): Promise<Tweet> {
  if (!text.trim()) throw new ValidationError('Tweet text must not be empty');
  if (text.length > 280) throw new ValidationError('Tweet text exceeds 280 characters');

  const fetchImpl = deps.fetch ?? fetch;
  const data = await apiRequest<{ data: Tweet }>(
    `${TWITTER_BASE}/tweets`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    },
    fetchImpl,
  );

  return data.data;
}

/**
 * Deletes a tweet by ID.
 *
 * @returns `true` if the tweet was deleted.
 */
export async function deleteTweet(
  config: TwitterConfig,
  tweetId: string,
  deps: TwitterDeps = {},
): Promise<boolean> {
  if (!tweetId.trim()) throw new ValidationError('tweetId is required');

  const fetchImpl = deps.fetch ?? fetch;
  const data = await apiRequest<{ data: { deleted: boolean } }>(
    `${TWITTER_BASE}/tweets/${tweetId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${config.bearerToken}` },
    },
    fetchImpl,
  );

  return data.data.deleted;
}

/**
 * Retrieves the most recent tweets from the authenticated user's timeline.
 *
 * @param userId - The X user ID whose timeline to fetch.
 * @param maxResults - Number of tweets to return (1–100, default 10).
 */
export async function getTimeline(
  config: TwitterConfig,
  userId: string,
  maxResults = 10,
  deps: TwitterDeps = {},
): Promise<TimelineTweet[]> {
  if (!userId.trim()) throw new ValidationError('userId is required');

  const fetchImpl = deps.fetch ?? fetch;
  const url = `${TWITTER_BASE}/users/${userId}/tweets?max_results=${String(maxResults)}&tweet.fields=author_id`;
  const data = await apiRequest<{ data: Array<{ id: string; text: string; author_id: string }> }>(
    url,
    { headers: { Authorization: `Bearer ${config.bearerToken}` } },
    fetchImpl,
  );

  return (data.data ?? []).map(t => ({ id: t.id, text: t.text, authorId: t.author_id }));
}

// ---------------------------------------------------------------------------
// Pinterest API
// ---------------------------------------------------------------------------

/**
 * Credentials required to authenticate with the Pinterest API.
 */
export interface PinterestConfig {
  /** OAuth 2.0 access token. */
  accessToken: string;
}

/** @internal */
export interface PinterestDeps {
  fetch?: FetchFn;
}

/** Represents a Pinterest pin. */
export interface Pin {
  id: string;
  title: string;
  description: string;
  link: string;
  mediaUrl: string;
}

/** Represents a Pinterest board. */
export interface Board {
  id: string;
  name: string;
  description: string;
}

const PINTEREST_BASE = 'https://api.pinterest.com/v5';

/**
 * Creates a new pin on the specified board.
 *
 * @example
 * ```ts
 * const pin = await createPin(config, {
 *   boardId: 'board_123',
 *   title: 'Check this out',
 *   description: 'A great resource.',
 *   link: 'https://example.com',
 *   mediaUrl: 'https://example.com/img.png',
 * });
 * ```
 */
export interface CreatePinOpts {
  boardId: string;
  title: string;
  description: string;
  link: string;
  mediaUrl: string;
}

export async function createPin(
  config: PinterestConfig,
  opts: CreatePinOpts,
  deps: PinterestDeps = {},
): Promise<Pin> {
  if (!opts.boardId.trim()) throw new ValidationError('boardId is required');
  if (!opts.mediaUrl.trim()) throw new ValidationError('mediaUrl is required');

  const fetchImpl = deps.fetch ?? fetch;
  const data = await apiRequest<{
    id: string;
    title: string;
    description: string;
    link: string;
    media: { images?: { originals?: { url: string } } };
  }>(
    `${PINTEREST_BASE}/pins`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board_id: opts.boardId,
        title: opts.title,
        description: opts.description,
        link: opts.link,
        media_source: {
          source_type: 'image_url',
          url: opts.mediaUrl,
        },
      }),
    },
    fetchImpl,
  );

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    link: data.link,
    mediaUrl: data.media?.images?.originals?.url ?? opts.mediaUrl,
  };
}

/**
 * Retrieves the boards belonging to the authenticated Pinterest user.
 */
export async function getBoards(
  config: PinterestConfig,
  deps: PinterestDeps = {},
): Promise<Board[]> {
  const fetchImpl = deps.fetch ?? fetch;
  const data = await apiRequest<{
    items: Array<{ id: string; name: string; description: string }>;
  }>(
    `${PINTEREST_BASE}/boards`,
    { headers: { Authorization: `Bearer ${config.accessToken}` } },
    fetchImpl,
  );

  return (data.items ?? []).map(b => ({
    id: b.id,
    name: b.name,
    description: b.description,
  }));
}

// ---------------------------------------------------------------------------
// TikTok & Instagram — webhook interface only
// ---------------------------------------------------------------------------

/**
 * TikTok and Instagram direct API access is not supported in this package
 * due to OAuth complexity and server-side callback requirements that are
 * incompatible with stateless Cloudflare Workers.
 *
 * **Recommended pattern**: Register a webhook endpoint in your Worker that
 * TikTok/Instagram calls after a user completes the OAuth flow. Store the
 * access token in your database and make platform API calls from a scheduled
 * Worker or queue consumer.
 *
 * @see https://developers.tiktok.com/doc/overview
 * @see https://developers.facebook.com/docs/instagram-api
 */
export const TIKTOK_WEBHOOK_ONLY = true;

/**
 * @see {@link TIKTOK_WEBHOOK_ONLY}
 */
export const INSTAGRAM_WEBHOOK_ONLY = true;
