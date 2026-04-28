/**
 * Phase D — Repository browser + AI assistant types.
 *
 * Studio's Code tab speaks GitHub via the admin-studio Worker. The Worker
 * holds the `GITHUB_TOKEN` secret and proxies all calls so that the browser
 * never sees the token.
 *
 * AI chat uses Anthropic SSE under the hood (with Grok/Groq fallbacks
 * available via `@adrper79-dot/llm`).
 */

/**
 * Single tree entry — a file or directory at a given path.
 *
 * Mirrors GitHub's `git/trees` response, trimmed to the fields the UI
 * actually needs.
 */
export interface RepoTreeNode {
  /** Full repo-relative path, e.g. `apps/admin-studio/src/index.ts`. */
  path: string;
  /** `tree` (directory) or `blob` (file). */
  type: 'tree' | 'blob';
  /** SHA of the entry — required when committing. */
  sha: string;
  /** Byte size for blobs. Trees report 0. */
  size: number;
}

/**
 * Decoded file content. The Worker decodes base64 from GitHub before
 * sending so the UI doesn't need to.
 */
export interface RepoFileContent {
  path: string;
  /** Branch the file was read from. */
  ref: string;
  /** Blob SHA — required when committing an update. */
  sha: string;
  /** UTF-8 text. Binary files are flagged via `binary: true` and omit `text`. */
  text?: string;
  binary: boolean;
  size: number;
}

/**
 * Branch metadata.
 */
export interface RepoBranch {
  name: string;
  /** Commit SHA at the tip. */
  sha: string;
  /** True for the repository's default branch (always `main` here). */
  isDefault: boolean;
  /** True if the branch is protected. Studio refuses to commit to protected branches. */
  protected: boolean;
}

/**
 * Pull request stub — what we return after creating one.
 */
export interface RepoPullRequest {
  number: number;
  url: string;
  state: 'open' | 'closed' | 'merged';
  head: string;
  base: string;
  title: string;
}

/**
 * Mode of an AI chat turn — drives system-prompt selection on the server.
 *
 *  - `generate`: produce new code from a description
 *  - `explain`:  explain selected code or an error message
 *  - `refactor`: rewrite selected code per instructions
 */
export type AIChatMode = 'generate' | 'explain' | 'refactor';

/**
 * One turn in a Studio AI conversation. The thread is stored client-side;
 * the Worker is stateless and re-receives the full thread each request.
 */
export interface AIChatTurn {
  role: 'user' | 'assistant';
  content: string;
  /** ISO timestamp, set client-side. */
  at: string;
}

/**
 * Body for `POST /ai/chat`.
 */
export interface AIChatRequest {
  mode: AIChatMode;
  /** Whole prior conversation, oldest first. */
  history: readonly AIChatTurn[];
  /** Latest user prompt (also appended to history server-side). */
  prompt: string;
  /**
   * Optional code snippet to operate on (the file or selection currently
   * open in the editor). The server packs it into the system prompt.
   */
  context?: {
    path?: string;
    snippet: string;
    language?: string;
  };
}

/**
 * Server-sent events emitted on `/ai/chat`.
 *
 *   token  → incremental assistant text
 *   error  → terminal failure (followed by stream close)
 *   done   → terminal success with final usage stats
 */
export type AIChatEvent =
  | { type: 'token'; delta: string }
  | { type: 'error'; message: string }
  | {
      type: 'done';
      provider: 'anthropic' | 'grok' | 'groq';
      tokens?: { input: number; output: number };
    };
