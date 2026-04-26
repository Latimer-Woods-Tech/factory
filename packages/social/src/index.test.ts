import { describe, it, expect, vi } from 'vitest';
import {
  postTweet,
  deleteTweet,
  getTimeline,
  createPin,
  getBoards,
  TIKTOK_WEBHOOK_ONLY,
  INSTAGRAM_WEBHOOK_ONLY,
} from './index.js';
import { ValidationError, InternalError } from '@factory/errors';

const TWITTER_CONFIG = { bearerToken: 'twitter-token' };
const PINTEREST_CONFIG = { accessToken: 'pinterest-token' };

function mockFetch(status: number, body: unknown) {
  const str = JSON.stringify(body);
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(str),
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// X / Twitter
// ---------------------------------------------------------------------------

describe('postTweet', () => {
  it('posts a tweet and returns the tweet object', async () => {
    const fetch = mockFetch(201, { data: { id: 't1', text: 'Hello!' } });
    const result = await postTweet(TWITTER_CONFIG, 'Hello!', { fetch });
    expect(result).toEqual({ id: 't1', text: 'Hello!' });
    const init = (fetch.mock.calls[0] as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer twitter-token');
  });

  it('throws ValidationError for empty text', async () => {
    await expect(postTweet(TWITTER_CONFIG, '')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for text over 280 chars', async () => {
    await expect(postTweet(TWITTER_CONFIG, 'x'.repeat(281))).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws InternalError on non-2xx response', async () => {
    const fetch = mockFetch(403, { message: 'Forbidden' });
    await expect(postTweet(TWITTER_CONFIG, 'Hello', { fetch })).rejects.toBeInstanceOf(InternalError);
  });
});

describe('deleteTweet', () => {
  it('returns true when deleted', async () => {
    const fetch = mockFetch(200, { data: { deleted: true } });
    const result = await deleteTweet(TWITTER_CONFIG, 'tweet-123', { fetch });
    expect(result).toBe(true);
    const [url] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('tweet-123');
  });

  it('throws ValidationError for empty tweetId', async () => {
    await expect(deleteTweet(TWITTER_CONFIG, '')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws InternalError on non-2xx response', async () => {
    const fetch = mockFetch(404, { message: 'Not found' });
    await expect(deleteTweet(TWITTER_CONFIG, 'x', { fetch })).rejects.toBeInstanceOf(InternalError);
  });
});

describe('getTimeline', () => {
  it('returns mapped timeline tweets', async () => {
    const fetch = mockFetch(200, {
      data: [
        { id: 't1', text: 'Tweet 1', author_id: 'user-1' },
        { id: 't2', text: 'Tweet 2', author_id: 'user-1' },
      ],
    });
    const result = await getTimeline(TWITTER_CONFIG, 'user-1', 2, { fetch });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 't1', text: 'Tweet 1', authorId: 'user-1' });
  });

  it('returns empty array when data is missing', async () => {
    const fetch = mockFetch(200, {});
    const result = await getTimeline(TWITTER_CONFIG, 'user-1', 5, { fetch });
    expect(result).toEqual([]);
  });

  it('throws ValidationError for empty userId', async () => {
    await expect(getTimeline(TWITTER_CONFIG, '')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws InternalError on non-2xx response', async () => {
    const fetch = mockFetch(500, { detail: 'error' });
    await expect(getTimeline(TWITTER_CONFIG, 'u', 10, { fetch })).rejects.toBeInstanceOf(InternalError);
  });
});

// ---------------------------------------------------------------------------
// Pinterest
// ---------------------------------------------------------------------------

describe('createPin', () => {
  const PIN_OPTS = {
    boardId: 'board-1',
    title: 'My Pin',
    description: 'A great resource',
    link: 'https://example.com',
    mediaUrl: 'https://example.com/img.png',
  };

  it('creates a pin and returns the pin object', async () => {
    const fetch = mockFetch(201, {
      id: 'pin-1',
      title: 'My Pin',
      description: 'A great resource',
      link: 'https://example.com',
      media: { images: { originals: { url: 'https://example.com/img.png' } } },
    });
    const result = await createPin(PINTEREST_CONFIG, PIN_OPTS, { fetch });
    expect(result.id).toBe('pin-1');
    expect(result.mediaUrl).toBe('https://example.com/img.png');
  });

  it('falls back to opts.mediaUrl when media images not present', async () => {
    const fetch = mockFetch(201, {
      id: 'pin-2',
      title: 'T',
      description: 'D',
      link: 'https://x.com',
      media: {},
    });
    const result = await createPin(PINTEREST_CONFIG, PIN_OPTS, { fetch });
    expect(result.mediaUrl).toBe(PIN_OPTS.mediaUrl);
  });

  it('throws ValidationError when boardId is empty', async () => {
    await expect(
      createPin(PINTEREST_CONFIG, { ...PIN_OPTS, boardId: '' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when mediaUrl is empty', async () => {
    await expect(
      createPin(PINTEREST_CONFIG, { ...PIN_OPTS, mediaUrl: '' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws InternalError on non-2xx response', async () => {
    const fetch = mockFetch(422, { message: 'Invalid' });
    await expect(createPin(PINTEREST_CONFIG, PIN_OPTS, { fetch })).rejects.toBeInstanceOf(InternalError);
  });
});

describe('getBoards', () => {
  it('returns mapped boards', async () => {
    const fetch = mockFetch(200, {
      items: [
        { id: 'b1', name: 'Inspiration', description: 'Inspo board' },
        { id: 'b2', name: 'Products', description: 'Our products' },
      ],
    });
    const result = await getBoards(PINTEREST_CONFIG, { fetch });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'b1', name: 'Inspiration', description: 'Inspo board' });
  });

  it('returns empty array when items is missing', async () => {
    const fetch = mockFetch(200, {});
    const result = await getBoards(PINTEREST_CONFIG, { fetch });
    expect(result).toEqual([]);
  });

  it('throws InternalError on non-2xx response', async () => {
    const fetch = mockFetch(401, { message: 'Unauthorized' });
    await expect(getBoards(PINTEREST_CONFIG, { fetch })).rejects.toBeInstanceOf(InternalError);
  });
});

// ---------------------------------------------------------------------------
// Platform constants
// ---------------------------------------------------------------------------

describe('platform webhook constants', () => {
  it('TIKTOK_WEBHOOK_ONLY is true', () => {
    expect(TIKTOK_WEBHOOK_ONLY).toBe(true);
  });

  it('INSTAGRAM_WEBHOOK_ONLY is true', () => {
    expect(INSTAGRAM_WEBHOOK_ONLY).toBe(true);
  });
});
