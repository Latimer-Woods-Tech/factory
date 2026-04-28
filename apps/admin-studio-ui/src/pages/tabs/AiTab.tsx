/**
 * Phase D — AI chat tab.
 *
 * Streaming SSE consumer for `POST /ai/chat`. Uses fetch + ReadableStream
 * (EventSource is GET-only). Renders token-by-token with mode buttons and
 * conversation history. Optional code context can be supplied free-form;
 * Phase D.2 will wire CodeTab → AiTab so the active file flows through.
 */
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AIChatEvent, AIChatMode, AIChatTurn } from '@adrper79-dot/studio-core';
import { useSession } from '../../stores/session.js';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

const MODES: ReadonlyArray<{ id: AIChatMode; label: string; hint: string }> = [
  { id: 'generate', label: 'Generate', hint: 'New Worker code' },
  { id: 'explain', label: 'Explain', hint: 'Walk through code' },
  { id: 'refactor', label: 'Refactor', hint: 'Improve existing code' },
];

function turn(role: 'user' | 'assistant', content: string): AIChatTurn {
  return { role, content, at: new Date().toISOString() };
}

export function AiTab() {
  const [history, setHistory] = useState<AIChatTurn[]>([]);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<AIChatMode>('generate');
  const [contextPath, setContextPath] = useState('');
  const [contextSnippet, setContextSnippet] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function send() {
    if (!prompt.trim() || streaming) return;
    const userTurn = turn('user', prompt.trim());
    const nextHistory: AIChatTurn[] = [...history, userTurn];
    setHistory(nextHistory);
    setPrompt('');
    setPartial('');
    setError(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const { token } = useSession.getState();
    const body = {
      mode,
      history: nextHistory,
      context: contextPath || contextSnippet
        ? { path: contextPath || undefined, snippet: contextSnippet || undefined }
        : undefined,
    };

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Request-Id': crypto.randomUUID(),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Stream failed: HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let assistantText = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split('\n\n');
        buf = frames.pop() ?? '';

        for (const frame of frames) {
          const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          let evt: AIChatEvent;
          try {
            evt = JSON.parse(json) as AIChatEvent;
          } catch {
            continue;
          }
          if (evt.type === 'token') {
            assistantText += evt.delta;
            setPartial(assistantText);
          } else if (evt.type === 'error') {
            setError(evt.message);
          }
        }
      }

      if (assistantText) {
        const assistantTurn = turn('assistant', assistantText);
        setHistory((h) => [...h, assistantTurn]);
      }
      setPartial('');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    setHistory([]);
    setPartial('');
    setError(null);
  }

  return (
    <div className="flex h-[calc(100vh-92px)] gap-4">
      <section className="flex-1 flex flex-col rounded border border-slate-800 bg-slate-900 min-w-0">
        <header className="border-b border-slate-800 px-3 py-2 flex items-center gap-2">
          <div className="flex gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                title={m.hint}
                className={`text-xs px-2 py-1 rounded border ${
                  mode === m.id
                    ? 'bg-emerald-700 border-emerald-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={reset}
              disabled={streaming || history.length === 0}
              className="text-xs px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Clear
            </button>
            {streaming && (
              <button
                onClick={stop}
                className="text-xs px-2 py-1 rounded border border-rose-700 bg-rose-900/40 text-rose-200 hover:bg-rose-900/60"
              >
                Stop
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
          {history.length === 0 && !partial && (
            <p className="text-slate-500">
              Ask Claude to generate, explain, or refactor Factory code. The system prompt enforces
              Workers/Hono/Drizzle/Web-Crypto standing orders.
            </p>
          )}
          {history.map((t, i) => (
            <Bubble key={i} role={t.role}>{t.content}</Bubble>
          ))}
          {partial && (
            <Bubble role="assistant" streaming>
              {partial}
            </Bubble>
          )}
          {error && <p className="text-rose-400 text-xs">⚠ {error}</p>}
        </div>

        <footer className="border-t border-slate-800 p-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={streaming}
            placeholder="Ask… (Cmd/Ctrl+Enter to send)"
            rows={3}
            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm font-mono text-slate-100 resize-none disabled:opacity-50"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => void send()}
              disabled={streaming || !prompt.trim()}
              className="text-xs px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40"
            >
              {streaming ? 'Streaming…' : 'Send'}
            </button>
          </div>
        </footer>
      </section>

      <aside className="w-80 shrink-0 flex flex-col rounded border border-slate-800 bg-slate-900 p-3 gap-3">
        <h3 className="text-xs uppercase tracking-wide text-slate-500">Code context (optional)</h3>
        <input
          value={contextPath}
          onChange={(e) => setContextPath(e.target.value)}
          placeholder="e.g. apps/admin-studio/src/index.ts"
          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-100"
        />
        <textarea
          value={contextSnippet}
          onChange={(e) => setContextSnippet(e.target.value)}
          placeholder="Paste relevant code…"
          rows={12}
          className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-[11px] font-mono text-slate-100 resize-none"
        />
        <p className="text-[11px] text-slate-500">
          Truncated to 8 KB server-side. Phase D.2 pipes the active CodeTab file in here automatically.
        </p>
      </aside>
    </div>
  );
}

function Bubble(props: { role: 'user' | 'assistant'; streaming?: boolean; children: ReactNode }) {
  const isUser = props.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded px-3 py-2 whitespace-pre-wrap font-mono text-[12px] leading-snug ${
          isUser
            ? 'bg-emerald-900/40 border border-emerald-800 text-emerald-100'
            : 'bg-slate-800 border border-slate-700 text-slate-100'
        }`}
      >
        {props.children}
        {props.streaming && <span className="inline-block w-2 h-3 bg-emerald-400 ml-0.5 animate-pulse" />}
      </div>
    </div>
  );
}
