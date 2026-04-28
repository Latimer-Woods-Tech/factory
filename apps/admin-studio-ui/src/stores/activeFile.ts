/**
 * Phase D.2 — cross-tab "active file" store.
 *
 * CodeTab writes here when the user opens a file or types in the editor.
 * AiTab reads it so that "Use active file as context" / "Ask AI to refactor"
 * actions know what the user is currently looking at.
 *
 * Kept deliberately minimal: just the path, branch, language, original SHA
 * (for commit concurrency control), the on-disk text, and any unsaved edits
 * the user has made in the editor.
 */
import { create } from 'zustand';

export interface ActiveFileState {
  path: string | null;
  branch: string;
  language: string;
  /** SHA of the blob as last read from GitHub. */
  baseSha: string | null;
  /** Original file text as last read from GitHub. */
  originalText: string;
  /** Editor's current text — equals originalText when not dirty. */
  draftText: string;
  dirty: boolean;
  /**
   * Set when CodeTab opens a file or AiTab applies a proposal.
   * Replaces both originalText and draftText, clears dirty.
   */
  open: (args: {
    path: string;
    branch: string;
    language: string;
    baseSha: string | null;
    text: string;
  }) => void;
  /** Editor change. */
  edit: (text: string) => void;
  /** After a successful commit — bump the SHA, drop dirty. */
  saved: (newBaseSha: string, savedText: string) => void;
  /** Discard edits and close the file. */
  close: () => void;
}

export const useActiveFile = create<ActiveFileState>((set) => ({
  path: null,
  branch: 'main',
  language: 'text',
  baseSha: null,
  originalText: '',
  draftText: '',
  dirty: false,
  open: ({ path, branch, language, baseSha, text }) =>
    set({
      path,
      branch,
      language,
      baseSha,
      originalText: text,
      draftText: text,
      dirty: false,
    }),
  edit: (text) =>
    set((s) => ({ draftText: text, dirty: text !== s.originalText })),
  saved: (newBaseSha, savedText) =>
    set({ baseSha: newBaseSha, originalText: savedText, draftText: savedText, dirty: false }),
  close: () =>
    set({
      path: null,
      baseSha: null,
      originalText: '',
      draftText: '',
      dirty: false,
    }),
}));

/**
 * Map a path to a Monaco/highlight language id. Kept identical to the
 * Worker's `guessLanguage` so AI proposals always come back fenced
 * with the same id the editor uses.
 */
export function guessLanguage(path: string): string {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'ts':
    case 'tsx': return 'typescript';
    case 'js':
    case 'jsx': return 'javascript';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'sql': return 'sql';
    case 'yml':
    case 'yaml': return 'yaml';
    case 'css': return 'css';
    case 'html': return 'html';
    default: return 'plaintext';
  }
}
