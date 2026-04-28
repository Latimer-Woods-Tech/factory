import { describe, it, expect } from 'vitest';
import { redactSecrets } from './audit.js';

describe('redactSecrets', () => {
  it('redacts well-known keys', () => {
    const result = redactSecrets({
      username: 'alice',
      password: 'secret',
      apiKey: 'k123',
      authorization: 'Bearer xxx',
    });
    expect(result.username).toBe('alice');
    expect(result.password).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
    expect(result.authorization).toBe('[REDACTED]');
  });

  it('redacts nested objects', () => {
    const result = redactSecrets({
      user: { email: 'a@b.co', token: 'xyz' },
    });
    expect((result.user as Record<string, unknown>).email).toBe('a@b.co');
    expect((result.user as Record<string, unknown>).token).toBe('[REDACTED]');
  });

  it('redacts keys containing secret words case-insensitively', () => {
    const result = redactSecrets({ MY_SECRET_KEY: 'shh', User_Token: 'tok' });
    expect(result.MY_SECRET_KEY).toBe('[REDACTED]');
    expect(result.User_Token).toBe('[REDACTED]');
  });
});
