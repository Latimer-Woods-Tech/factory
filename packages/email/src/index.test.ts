import { describe, it, expect, vi } from 'vitest';
import { createEmailClient } from './index.js';
import { InternalError } from '@factory/errors';

const BASE_CONFIG = {
  resendApiKey: 'test-key',
  fromAddress: 'noreply@example.com',
  fromName: 'Test Sender',
};

function mockFetch(status: number, body: unknown) {
  const bodyStr = JSON.stringify(body);
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(bodyStr),
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

describe('createEmailClient', () => {
  describe('sendTransactional', () => {
    it('sends a POST to /emails and returns the id', async () => {
      const fetch = mockFetch(200, { id: 'msg_123' });
      const client = createEmailClient(BASE_CONFIG, { fetch });

      const result = await client.sendTransactional({
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

      expect(result).toEqual({ id: 'msg_123' });
      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.resend.com/emails');
      expect(init.method).toBe('POST');
      const sent = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(sent['from']).toBe('Test Sender <noreply@example.com>');
      expect(sent['to']).toBe('user@example.com');
      expect(sent['subject']).toBe('Hello');
    });

    it('includes optional text and replyTo', async () => {
      const fetch = mockFetch(200, { id: 'msg_456' });
      const client = createEmailClient(BASE_CONFIG, { fetch });

      await client.sendTransactional({
        to: 'x@y.com',
        subject: 'S',
        html: '<b>b</b>',
        text: 'plain',
        replyTo: 'reply@example.com',
      });

      const sent = JSON.parse(
        (fetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>;
      expect(sent['text']).toBe('plain');
      expect(sent['reply_to']).toBe('reply@example.com');
    });

    it('throws InternalError on non-2xx response', async () => {
      const fetch = mockFetch(422, { message: 'Invalid email' });
      const client = createEmailClient(BASE_CONFIG, { fetch });

      await expect(
        client.sendTransactional({ to: 'bad', subject: 'Hi', html: '<p>Hi</p>' }),
      ).rejects.toBeInstanceOf(InternalError);
    });

    it('sets Authorization header from apiKey', async () => {
      const fetch = mockFetch(200, { id: 'x' });
      const client = createEmailClient({ ...BASE_CONFIG, resendApiKey: 'secret-key' }, { fetch });
      await client.sendTransactional({ to: 'a@b.com', subject: 'S', html: '<p/>' });

      const init = (fetch.mock.calls[0] as [string, RequestInit])[1];
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer secret-key');
    });
  });

  describe('enrollDrip', () => {
    it('posts to /emails with sequence tag', async () => {
      const fetch = mockFetch(200, { id: 'drip_1' });
      const client = createEmailClient(BASE_CONFIG, { fetch });

      await client.enrollDrip({ userId: 'u1', email: 'user@test.com', sequence: 'onboarding' });

      expect(fetch).toHaveBeenCalledOnce();
      const sent = JSON.parse(
        (fetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>;
      expect(Array.isArray(sent['tags'])).toBe(true);
      const tags = sent['tags'] as Array<{ name: string; value: string }>;
      expect(tags.some(t => t.name === 'sequence' && t.value === 'onboarding')).toBe(true);
      expect(tags.some(t => t.name === 'userId' && t.value === 'u1')).toBe(true);
    });

    it('includes extra data as metadata', async () => {
      const fetch = mockFetch(200, { id: 'drip_2' });
      const client = createEmailClient(BASE_CONFIG, { fetch });

      await client.enrollDrip({
        userId: 'u2',
        email: 'u2@test.com',
        sequence: 'promo',
        data: { plan: 'pro' },
      });

      const sent = JSON.parse(
        (fetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>;
      expect(sent['metadata']).toEqual({ plan: 'pro' });
    });

    it('throws InternalError on non-2xx response', async () => {
      const fetch = mockFetch(500, { message: 'server error' });
      const client = createEmailClient(BASE_CONFIG, { fetch });

      await expect(
        client.enrollDrip({ userId: 'u', email: 'u@t.com', sequence: 's' }),
      ).rejects.toBeInstanceOf(InternalError);
    });
  });

  describe('unsubscribe', () => {
    it('posts to /contacts with unsubscribed: true', async () => {
      const fetch = mockFetch(200, { id: 'contact_1' });
      const client = createEmailClient(BASE_CONFIG, { fetch });

      await client.unsubscribe('user-999', 'unsub@test.com');

      const sent = JSON.parse(
        (fetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>;
      expect(sent['email']).toBe('unsub@test.com');
      expect(sent['unsubscribed']).toBe(true);
      expect((sent['metadata'] as Record<string, string>)['userId']).toBe('user-999');
    });

    it('throws InternalError on non-2xx response', async () => {
      const fetch = mockFetch(404, { message: 'not found' });
      const client = createEmailClient(BASE_CONFIG, { fetch });

      await expect(client.unsubscribe('u', 'x@y.com')).rejects.toBeInstanceOf(InternalError);
    });
  });
});
