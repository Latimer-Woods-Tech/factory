import { useState } from 'react';
import { apiFetch } from '../../lib/api.js';

type Mode = 'generate' | 'explain' | 'refactor';

export function AiTab() {
  const [mode, setMode] = useState<Mode>('explain');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const res = await apiFetch<{ response: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt, mode }),
      });
      setResponse(res.response);
    } catch (err) {
      setResponse(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">AI Chat</h1>
      <p className="text-sm text-slate-400">
        Phase A stub. Phase E adds Monaco diff editor, repo context retrieval, and PR proposals.
      </p>

      <div className="flex gap-2">
        {(['generate', 'explain', 'refactor'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 rounded text-sm ${
              mode === m ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={6}
        placeholder="Ask about the codebase, request a refactor, or describe a feature…"
        className="w-full rounded bg-slate-900 border border-slate-800 p-3 text-sm text-white"
      />

      <button
        disabled={busy || !prompt.trim()}
        onClick={send}
        className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? 'Thinking…' : 'Send'}
      </button>

      {response && (
        <div className="rounded border border-slate-800 bg-slate-900 p-4 text-sm text-slate-200 whitespace-pre-wrap">
          {response}
        </div>
      )}
    </div>
  );
}
