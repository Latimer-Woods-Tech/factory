import { describe, it, expect } from 'vitest';
import {
  requireEnv,
  requireRole,
  isSessionExpired,
  requiredConfirmationTier,
  isEnvironment,
  isRole,
  maxSessionAge,
  type EnvContext,
} from './env-context.js';

const baseCtx: EnvContext = {
  env: 'staging',
  sessionId: 'sess-1',
  userId: 'user-1',
  userEmail: 'a@b.co',
  role: 'admin',
  envLockedAt: Date.now(),
};

describe('requireEnv', () => {
  it('allows when env in list', () => {
    expect(() => requireEnv(baseCtx, ['staging', 'production'])).not.toThrow();
  });
  it('throws when env not in list', () => {
    expect(() => requireEnv(baseCtx, ['production'])).toThrow();
  });
});

describe('requireRole', () => {
  it('allows equal role', () => {
    expect(() => requireRole(baseCtx, 'admin')).not.toThrow();
  });
  it('allows higher role', () => {
    expect(() => requireRole({ ...baseCtx, role: 'owner' }, 'admin')).not.toThrow();
  });
  it('throws lower role', () => {
    expect(() => requireRole({ ...baseCtx, role: 'viewer' }, 'admin')).toThrow();
  });
});

describe('isSessionExpired', () => {
  it('local 25h ago is expired', () => {
    const ctx = { ...baseCtx, env: 'local' as const, envLockedAt: Date.now() - 25 * 3600 * 1000 };
    expect(isSessionExpired(ctx)).toBe(true);
  });
  it('production 5h ago is expired', () => {
    const ctx = { ...baseCtx, env: 'production' as const, envLockedAt: Date.now() - 5 * 3600 * 1000 };
    expect(isSessionExpired(ctx)).toBe(true);
  });
  it('production 3h ago is not expired', () => {
    const ctx = { ...baseCtx, env: 'production' as const, envLockedAt: Date.now() - 3 * 3600 * 1000 };
    expect(isSessionExpired(ctx)).toBe(false);
  });
});

describe('requiredConfirmationTier', () => {
  it('local trivial = 0', () => expect(requiredConfirmationTier('local', 'trivial')).toBe(0));
  it('local irreversible = 2', () => expect(requiredConfirmationTier('local', 'irreversible')).toBe(2));
  it('staging reversible = 1', () => expect(requiredConfirmationTier('staging', 'reversible')).toBe(1));
  it('production trivial = 1', () => expect(requiredConfirmationTier('production', 'trivial')).toBe(1));
  it('production reversible = 2', () => expect(requiredConfirmationTier('production', 'reversible')).toBe(2));
  it('production irreversible = 3', () => expect(requiredConfirmationTier('production', 'irreversible')).toBe(3));
});

describe('maxSessionAge', () => {
  it('production 4h', () => expect(maxSessionAge('production')).toBe(4 * 3600 * 1000));
  it('staging 24h', () => expect(maxSessionAge('staging')).toBe(24 * 3600 * 1000));
  it('local 24h', () => expect(maxSessionAge('local')).toBe(24 * 3600 * 1000));
});

describe('type guards', () => {
  it('isEnvironment', () => {
    expect(isEnvironment('local')).toBe(true);
    expect(isEnvironment('prod')).toBe(false);
  });
  it('isRole', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('superadmin')).toBe(false);
  });
});
