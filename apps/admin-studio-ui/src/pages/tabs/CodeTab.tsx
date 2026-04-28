/**
 * Phase D — Code tab.
 *
 * Read-only file browser backed by `/repo/*` worker routes. Phase D.2 adds
 * Monaco for editing + commit/PR. For now the viewer is a syntax-light
 * `<pre>` so we can ship the GitHub plumbing without the 3MB editor bundle.
 */
import { useEffect, useMemo, useState } from 'react';
import type {
  RepoBranch,
  RepoFileContent,
  RepoTreeNode,
} from '@adrper79-dot/studio-core';
import { apiFetch } from '../../lib/api.js';

interface TreeFolder {
  name: string;
  path: string;
  children: Map<string, TreeFolder>;
  files: RepoTreeNode[];
}

function buildTree(nodes: readonly RepoTreeNode[]): TreeFolder {
  const root: TreeFolder = { name: '', path: '', children: new Map(), files: [] };
  for (const n of nodes) {
    const parts = n.path.split('/');
    let cur = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const seg = parts[i]!;
      let next = cur.children.get(seg);
      if (!next) {
        next = {
          name: seg,
          path: parts.slice(0, i + 1).join('/'),
          children: new Map(),
          files: [],
        };
        cur.children.set(seg, next);
      }
      cur = next;
    }
    if (n.type === 'blob') cur.files.push(n);
  }
  return root;
}

export function CodeTab() {
  const [branches, setBranches] = useState<RepoBranch[]>([]);
  const [ref, setRef] = useState<string>('main');
  const [tree, setTree] = useState<RepoTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [file, setFile] = useState<RepoFileContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ branches: RepoBranch[] }>('/repo/branches')
      .then((r) => setBranches(r.branches))
      .catch((err) => setTreeError((err as Error).message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTreeLoading(true);
    setTreeError(null);
    apiFetch<{ nodes: RepoTreeNode[]; truncated: boolean }>(`/repo/tree?ref=${encodeURIComponent(ref)}`)
      .then((r) => {
        if (cancelled) return;
        setTree(r.nodes);
      })
      .catch((err) => {
        if (cancelled) return;
        setTreeError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setTreeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  async function openFile(path: string) {
    setOpenPath(path);
    setFile(null);
    setFileLoading(true);
    try {
      const r = await apiFetch<{ file: RepoFileContent }>(
        `/repo/file?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(ref)}`,
      );
      setFile(r.file);
    } catch (err) {
      setFile({ path, ref, sha: '', binary: true, size: 0, text: `Error: ${(err as Error).message}` });
    } finally {
      setFileLoading(false);
    }
  }

  const root = useMemo(() => buildTree(tree), [tree]);

  return (
    <div className="flex h-[calc(100vh-92px)] gap-4">
      <aside className="w-80 shrink-0 flex flex-col rounded border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-2">
          <label className="text-[11px] uppercase tracking-wide text-slate-500">Branch</label>
          <select
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className="mt-1 w-full rounded bg-slate-800 text-white text-xs px-2 py-1.5 border border-slate-700"
          >
            {branches.length === 0 && <option value="main">main</option>}
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}{b.isDefault ? ' (default)' : ''}{b.protected ? ' 🔒' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-auto text-xs text-slate-300 p-2">
          {treeLoading && <p className="text-slate-500">Loading tree…</p>}
          {treeError && <p className="text-rose-400">{treeError}</p>}
          {!treeLoading && !treeError && (
            <FolderNode folder={root} depth={0} onPick={openFile} active={openPath} initialOpen />
          )}
        </div>
      </aside>

      <section className="flex-1 flex flex-col rounded border border-slate-800 bg-slate-900 min-w-0">
        <header className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
          {openPath ? (
            <>
              <span className="font-mono text-slate-200 truncate">{openPath}</span>
              {file && !file.binary && (
                <span className="ml-auto text-slate-500">{file.size} bytes</span>
              )}
            </>
          ) : (
            <span>Select a file to view its contents.</span>
          )}
        </header>
        <div className="flex-1 overflow-auto">
          {fileLoading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
          {file && file.binary && (
            <p className="p-4 text-sm text-slate-400">
              Binary or oversized file — preview disabled. Phase D.2 will surface a download link.
            </p>
          )}
          {file && !file.binary && file.text !== undefined && (
            <pre className="p-3 text-[12px] leading-snug font-mono text-slate-200 whitespace-pre overflow-auto">
              {file.text}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}

function FolderNode(props: {
  folder: TreeFolder;
  depth: number;
  onPick: (path: string) => void;
  active: string | null;
  initialOpen?: boolean;
}) {
  const { folder, depth, onPick, active } = props;
  const [open, setOpen] = useState<boolean>(Boolean(props.initialOpen));
  const childFolders = [...folder.children.values()].sort((a, b) => a.name.localeCompare(b.name));
  const files = [...folder.files].sort((a, b) => a.path.localeCompare(b.path));

  if (depth === 0) {
    return (
      <div>
        {childFolders.map((c) => (
          <FolderNode key={c.path} folder={c} depth={1} onPick={onPick} active={active} />
        ))}
        {files.map((f) => (
          <FileLink key={f.path} node={f} depth={1} onPick={onPick} active={active} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 w-full text-left hover:bg-slate-800/50 px-1 rounded"
        style={{ paddingLeft: `${depth * 8}px` }}
      >
        <span className="text-slate-500 w-3">{open ? '▾' : '▸'}</span>
        <span className="text-slate-300">{folder.name}</span>
      </button>
      {open && (
        <>
          {childFolders.map((c) => (
            <FolderNode key={c.path} folder={c} depth={depth + 1} onPick={onPick} active={active} />
          ))}
          {files.map((f) => (
            <FileLink key={f.path} node={f} depth={depth + 1} onPick={onPick} active={active} />
          ))}
        </>
      )}
    </div>
  );
}

function FileLink(props: {
  node: RepoTreeNode;
  depth: number;
  onPick: (path: string) => void;
  active: string | null;
}) {
  const { node, depth, onPick, active } = props;
  const name = node.path.split('/').pop() ?? node.path;
  const isActive = active === node.path;
  return (
    <button
      onClick={() => onPick(node.path)}
      className={`flex items-center gap-1 w-full text-left px-1 rounded ${
        isActive ? 'bg-emerald-900/40 text-emerald-200' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
      }`}
      style={{ paddingLeft: `${depth * 8 + 12}px` }}
    >
      <span>{name}</span>
    </button>
  );
}
