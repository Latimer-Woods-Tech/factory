import { describe, it, expect } from 'vitest';
import {
  MANIFEST_VERSION,
  validateManifest,
  type FunctionManifest,
  type ManifestEntry,
} from './manifest.js';

describe('manifest', () => {
  const goodEntry: ManifestEntry = {
    method: 'GET',
    path: '/health',
    auth: 'public',
    summary: 'Health check',
  };
  const goodManifest: FunctionManifest = {
    manifestVersion: MANIFEST_VERSION,
    app: 'admin-studio',
    env: 'production',
    generatedAt: '2026-04-28T00:00:00.000Z',
    entries: [goodEntry],
  };

  it('accepts a well-formed manifest', () => {
    expect(validateManifest(goodManifest)).toBeNull();
  });

  it('rejects wrong manifestVersion', () => {
    expect(validateManifest({ ...goodManifest, manifestVersion: 999 })).toMatch(/manifestVersion/);
  });

  it('rejects missing app', () => {
    expect(validateManifest({ ...goodManifest, app: '' })).toMatch(/app required/);
  });

  it('rejects entries that are not arrays', () => {
    expect(validateManifest({ ...goodManifest, entries: 'oops' })).toMatch(/entries/);
  });

  it('rejects missing env', () => {
    expect(validateManifest({ ...goodManifest, env: '' })).toMatch(/env required/);
  });

  it('rejects missing generatedAt', () => {
    expect(validateManifest({ ...goodManifest, generatedAt: 42 })).toMatch(/generatedAt required/);
  });

  it('rejects entry with missing method', () => {
    const entry = { ...goodEntry, method: '' };
    expect(validateManifest({ ...goodManifest, entries: [entry] })).toMatch(/method required/);
  });

  it('rejects entry with missing auth', () => {
    const entry = { ...goodEntry, auth: 99 };
    expect(validateManifest({ ...goodManifest, entries: [entry] })).toMatch(/auth required/);
  });

  it('rejects entry with missing summary', () => {
    const entry = { ...goodEntry, summary: 0 };
    expect(validateManifest({ ...goodManifest, entries: [entry] })).toMatch(/summary required/);
  });

  it('rejects entries with non-/ paths', () => {
    expect(
      validateManifest({ ...goodManifest, entries: [{ ...goodEntry, path: 'health' }] }),
    ).toMatch(/path must start with \//);
  });

  it('rejects null', () => {
    expect(validateManifest(null)).toMatch(/object/);
  });
});
