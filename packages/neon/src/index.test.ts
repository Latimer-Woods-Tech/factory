import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const executeMock = vi.fn(() => Promise.resolve({ rows: [] }));
  const drizzleClient = { execute: executeMock };
  return {
    executeMock,
    drizzleClient,
    drizzleMock: vi.fn(() => drizzleClient),
    neonMock: vi.fn(() => ({ __neon: true })),
    migrateMock: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('@neondatabase/serverless', () => ({
  neon: mocks.neonMock,
}));

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: mocks.drizzleMock,
}));

vi.mock('drizzle-orm/neon-http/migrator', () => ({
  migrate: mocks.migrateMock,
}));

import { createDb, runMigrations, withTenant } from './index';

beforeEach(() => {
  mocks.executeMock.mockClear();
  mocks.drizzleMock.mockClear();
  mocks.neonMock.mockClear();
  mocks.migrateMock.mockClear();
});

describe('neon', () => {
  it('createDb wraps the neon HTTP client with drizzle', () => {
    const db = createDb({ connectionString: 'postgres://example' });

    expect(mocks.neonMock).toHaveBeenCalledWith('postgres://example');
    expect(mocks.drizzleMock).toHaveBeenCalledTimes(1);
    expect(db).toBe(mocks.drizzleClient);
  });

  it('createDb throws when connectionString is missing', () => {
    expect(() => createDb({ connectionString: '' })).toThrow(
      'Hyperdrive connectionString is required',
    );
  });

  it('withTenant sets the session variable and calls fn', async () => {
    const db = createDb({ connectionString: 'postgres://example' });
    const fn = vi.fn((received: typeof db) => {
      expect(received).toBe(db);
      return Promise.resolve('result');
    });

    const result = await withTenant(db, 'tenant-123', fn);

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mocks.executeMock).toHaveBeenCalledTimes(1);
  });

  it('withTenant rejects an empty tenantId', async () => {
    const db = createDb({ connectionString: 'postgres://example' });

    await expect(withTenant(db, '', vi.fn())).rejects.toThrow(
      'tenantId is required for withTenant',
    );
  });

  it('withTenant propagates errors thrown by fn', async () => {
    const db = createDb({ connectionString: 'postgres://example' });
    const failure = new Error('boom');

    await expect(
      withTenant(db, 'tenant-123', () => Promise.reject(failure)),
    ).rejects.toBe(failure);
  });

  it('runMigrations delegates to drizzle migrate', async () => {
    const db = createDb({ connectionString: 'postgres://example' });

    await runMigrations(db, { migrationsFolder: './drizzle' });

    expect(mocks.migrateMock).toHaveBeenCalledWith(db, { migrationsFolder: './drizzle' });
  });
});