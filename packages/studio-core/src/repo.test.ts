import { describe, it, expect } from 'vitest';
import type {
  AIChatEvent,
  AIChatRequest,
  AIChatTurn,
  RepoBranch,
  RepoFileContent,
  RepoTreeNode,
} from './repo.js';

describe('repo types', () => {
  it('RepoTreeNode discriminates tree vs blob', () => {
    const dir: RepoTreeNode = { path: 'apps', type: 'tree', sha: 'a', size: 0 };
    const file: RepoTreeNode = {
      path: 'apps/admin-studio/src/index.ts',
      type: 'blob',
      sha: 'b',
      size: 1234,
    };
    expect(dir.type).toBe('tree');
    expect(file.size).toBeGreaterThan(0);
  });

  it('RepoFileContent supports binary flag without text', () => {
    const bin: RepoFileContent = { path: 'logo.png', ref: 'main', sha: 'c', binary: true, size: 99 };
    const txt: RepoFileContent = { path: 'README.md', ref: 'main', sha: 'd', binary: false, size: 11, text: 'hi' };
    expect(bin.text).toBeUndefined();
    expect(txt.text).toBe('hi');
  });

  it('RepoBranch flags default + protected', () => {
    const main: RepoBranch = { name: 'main', sha: 'aaa', isDefault: true, protected: true };
    expect(main.isDefault && main.protected).toBe(true);
  });
});

describe('AI chat types', () => {
  it('AIChatRequest carries history + optional context', () => {
    const turn: AIChatTurn = { role: 'user', content: 'hi', at: new Date().toISOString() };
    const req: AIChatRequest = {
      mode: 'explain',
      history: [turn],
      prompt: 'what does this do?',
      context: { path: 'src/x.ts', snippet: 'export const a = 1', language: 'ts' },
    };
    expect(req.mode).toBe('explain');
    expect(req.history.length).toBe(1);
  });

  it('AIChatEvent discriminated union has token | error | done', () => {
    const tok: AIChatEvent = { type: 'token', delta: 'x' };
    const err: AIChatEvent = { type: 'error', message: 'boom' };
    const done: AIChatEvent = { type: 'done', provider: 'anthropic', tokens: { input: 1, output: 2 } };
    expect(tok.type).toBe('token');
    expect(err.type).toBe('error');
    expect(done.type).toBe('done');
  });
});
