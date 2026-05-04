#!/usr/bin/env node
// pr-review.mjs — Factory canonical architecture reviewer
// Detects CODEOWNERS tier, runs deterministic constraint checks, calls Claude
// for architectural reasoning, then posts a real GitHub Review (APPROVE or
// REQUEST_CHANGES) using the factory-cross-repo app token.
//
// Decision model:
//   Green tier + no violations  → APPROVE (no LLM call)
//   Yellow tier + no violations → APPROVE
//   Any tier + violations       → REQUEST_CHANGES
//   Red tier + no violations    → APPROVE with explicit red-tier notice
//   /admin mutations (any tier) → REQUEST_CHANGES (FRIDGE rule 4)

const ORG = 'Latimer-Woods-Tech';
const REVIEW_BOT_LOGIN = 'factory-cross-repo[bot]';
const MAX_DIFF_CHARS = 28_000;

const {
  GH_TOKEN,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = 'claude-sonnet-4-20250514',
  PR_NUMBER,
  REPO,
  PR_SHA,
} = process.env;

const repo = REPO?.split('/')[1] ?? REPO;
const prNum = parseInt(PR_NUMBER, 10);

// ─── GitHub API ───────────────────────────────────────────────────────────────

async function gh(method, path, body, accept) {
  const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: accept ?? 'application/vnd.github+json',
      Authorization: `Bearer ${GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GH ${method} ${path} → ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Tier detection (mirrors CODEOWNERS trust tiers) ─────────────────────────

const RED_PATTERNS = [
  /^\.github\/workflows\//,
  /^\.github\/scripts\//,
  /^\.github\/CODEOWNERS$/,
  /^\.github\/settings\.yml$/,
  /^packages\//,
  /migrations\//,
  /wrangler\.(jsonc?|toml)$/,
  /handlers\/(billing|admin|stripe)/,
  /capabilities\.yml$/,
  /docs\/service-registry\.yml$/,
  /docs\/supervisor\/(plans|FRIDGE)/,
  /apps\/supervisor\//,
];

const GREEN_PATTERNS = [
  /^docs\//,
  /\.md$/,
  /^session\//,
  /^documents\//,
  /^\.github\/ISSUE_TEMPLATE\//,
  /^\.github\/PULL_REQUEST_TEMPLATE/,
];

const ADMIN_MUTATION_PATTERNS = [
  /handlers\/(billing|admin|stripe)/,
  /\/admin\//,
  /stripe/i,
];

function detectTier(filenames) {
  if (filenames.some(f => RED_PATTERNS.some(p => p.test(f)))) return 'red';
  if (filenames.every(f => GREEN_PATTERNS.some(p => p.test(f)))) return 'green';
  return 'yellow';
}

function hasAdminMutation(filenames) {
  return filenames.some(f => ADMIN_MUTATION_PATTERNS.some(p => p.test(f)));
}

// ─── Deterministic constraint checks (no LLM) ────────────────────────────────
// Run on added lines only — deletions removing violations are fine.

function extractAddedLines(files) {
  return files
    .map(f => (f.patch ?? '').split('\n').filter(l => l.startsWith('+')).join('\n'))
    .join('\n');
}

function runDeterministicChecks(addedLines, filenames) {
  const violations = [];
  const warnings = [];

  if (/\bprocess\.env\b/.test(addedLines))
    violations.push({ constraint: 'No process.env', detail: 'Use c.env / env bindings instead of process.env' });

  if (/\brequire\s*\(/.test(addedLines))
    violations.push({ constraint: 'No CommonJS require()', detail: 'ESM imports only — replace require() with import' });

  if (/\bnew Buffer\b|\bBuffer\.from\b|\bBuffer\.alloc\b/.test(addedLines))
    violations.push({ constraint: 'No Buffer', detail: 'Use Uint8Array, TextEncoder, or TextDecoder instead of Buffer' });

  if (/from\s+['"](?:fs|path|crypto)['"]/m.test(addedLines))
    violations.push({ constraint: 'No Node.js built-ins', detail: 'fs, path, crypto are not available in Workers — use platform-safe APIs' });

  if (/from\s+['"]node:/m.test(addedLines))
    violations.push({ constraint: 'No node: imports', detail: 'node: protocol imports are not available in Cloudflare Workers' });

  if (/from\s+['"](?:express|fastify|next)['"]/m.test(addedLines))
    violations.push({ constraint: 'No Express/Fastify/Next', detail: 'Use Hono for routing — no other HTTP frameworks' });

  if (/import\s+.*jsonwebtoken/m.test(addedLines))
    violations.push({ constraint: 'No jsonwebtoken', detail: 'Use Web Crypto API for JWT — never the jsonwebtoken package' });

  // Secret in vars block (wrangler config)
  if (filenames.some(f => /wrangler/.test(f)) &&
      /vars:\s*[\s\S]*?(?:KEY|SECRET|TOKEN|PASSWORD)\s*:/im.test(addedLines))
    violations.push({ constraint: 'No secrets in wrangler vars', detail: 'Use wrangler secret put — never put secrets in the vars block' });

  // Fetch without error handling
  const rawFetchMatches = addedLines.match(/await\s+fetch\s*\(/g) ?? [];
  const handledFetchMatches = addedLines.match(/(?:\.ok|\.status|res\.ok|response\.ok)/g) ?? [];
  if (rawFetchMatches.length > handledFetchMatches.length)
    warnings.push({ detail: `${rawFetchMatches.length} fetch() call(s) detected — verify each checks .ok or .status before consuming the body` });

  // any in TypeScript (warning only — can't reliably detect without type info)
  const anyCount = (addedLines.match(/:\s*any\b/g) ?? []).length;
  if (anyCount > 0)
    warnings.push({ detail: `${anyCount} use(s) of \`any\` type — strict mode forbids any in public APIs` });

  return { violations, warnings };
}

// ─── Canonical constraint context (injected as cached system block) ───────────

const CONSTRAINT_BLOCK = `\
## Factory Hard Constraints (CLAUDE.md)
- Runtime: Cloudflare Workers only — no Node.js, no Docker, no VMs
- Router: Hono only — never Express, Fastify, Next.js
- Database: Neon Postgres via Hyperdrive binding (env.DB / c.env.DB)
- Auth: JWT via Web Crypto API — never the \`jsonwebtoken\` package
- LLM chain: Anthropic → Grok → Groq — never direct OpenAI in Workers
- No \`process.env\` — use Hono or Worker bindings (c.env.VAR / env.VAR)
- No Node.js built-ins: no \`fs\`, \`path\`, \`crypto\`, no \`node:\` imports
- No CommonJS \`require()\` — ESM \`import\` / \`export\` only
- No \`Buffer\` — use \`Uint8Array\`, \`TextEncoder\`, \`TextDecoder\`
- No raw \`fetch\` without explicit error handling on every call
- No secrets in source code or in wrangler.jsonc \`vars\` block
- TypeScript strict mode — zero \`any\` in public APIs
- Build: tsup ESM only — no CJS output
- Test: Vitest + @cloudflare/vitest-pool-workers

## FRIDGE Rules (non-negotiable operating rules)
1. wordis-bond is off-limits to all automation — CODEOWNERS + denylist.
2. No credentials in docs, memory, plans, issue bodies, PRs, or comments. Rotate if leaked; do not just delete from git.
3. Red-tier paths never auto-merge: .github/workflows/**, packages/**, migrations/**, Stripe code, production wrangler config, production Neon user tables.
4. Every /admin mutation requires out-of-band CODEOWNER ✅ — plan-approval and PR-review do not substitute.
5. Per-run LLM budget: $5 USD hard cap. On BUDGET_EXCEEDED: pause, label supervisor:budget-paused, file a human issue.
6. Single-writer per app via LockDO. Claim lock before acting, renew every 10 min, release on close.
7. Issues must carry supervisor:approved-source before supervisor pickup.
8. Irreversible actions require explicit human approval — includes deleting CF resources, rulesets, Stripe mutations, live email/SMS outside test mode.
9. No-template issues: classify Red, label supervisor:no-template. Do not invent plans from scratch.
10. If the plan is wrong, file an issue against ARCHITECTURE.md. Tag a CODEOWNER. Do not improvise.

## Trust Tiers (CODEOWNERS)
- 🟢 Green: docs/**, *.md, session/** — low risk, auto-approvable
- 🟡 Yellow: apps/*/src/**, client/**, tests/** — review required, can approve if clean
- 🔴 Red: .github/workflows/**, packages/**, migrations/**, wrangler configs, capabilities.yml, service-registry.yml, supervisor plans — highest risk

## Package Dependency Order (violations = circular import risk)
errors → monitoring → logger → realtime → auth → neon → stripe → llm → telephony → analytics → deploy → testing → email → copy → content → social → seo → crm → compliance → admin → video → schedule → validation`;

const REVIEW_SCHEMA = `\
## Your task
Review the PR diff below against the Factory constraints above.
The deterministic checks (process.env, Buffer, require, etc.) have already been run — do NOT re-check those.
Focus on:
- Architectural fit (is this the right approach for the Factory stack?)
- Error handling patterns (every fetch, every DB call)
- Type safety concerns beyond simple \`any\` (unsafe casts, missing generics)
- Package dependency order violations (importing a higher-level package from a lower-level one)
- FRIDGE rule violations not caught by deterministic checks
- Anything that would break in a Workers runtime that a Node.js dev might miss

Output ONLY valid JSON — no markdown wrapper, no explanation outside the JSON:
{
  "architectural_concerns": [
    { "file": "path/to/file.ts", "line": 42, "detail": "description of concern" }
  ],
  "warnings": [
    { "file": "path/to/file.ts", "line": null, "detail": "description" }
  ],
  "summary": "2-4 sentence plain-English summary of what this PR does and what you found. Be specific about the files and patterns involved.",
  "lgtm": true
}

"lgtm": true means no architectural concerns were found (warnings are OK).
"lgtm": false means the PR has issues that should block merge.
Keep architectural_concerns to genuine problems — do not flag style preferences.`;

// ─── LLM review ──────────────────────────────────────────────────────────────

async function callClaude(prTitle, tier, files, deterministicWarnings) {
  const filesSummary = files.map(f => `  ${f.status ?? 'modified'}: ${f.filename}`).join('\n');
  const diffText = files
    .filter(f => f.patch)
    .map(f => `### ${f.filename}\n\`\`\`diff\n${f.patch}\n\`\`\``)
    .join('\n\n');

  const truncatedDiff = diffText.length > MAX_DIFF_CHARS
    ? diffText.slice(0, MAX_DIFF_CHARS) + '\n\n[... diff truncated at 28k chars — review remaining files manually]'
    : diffText;

  const deterministicNote = deterministicWarnings.length > 0
    ? `\nDeterministic warnings already flagged (do not re-check):\n${deterministicWarnings.map(w => `- ${w.detail}`).join('\n')}\n`
    : '';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: [
        { type: 'text', text: CONSTRAINT_BLOCK, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: REVIEW_SCHEMA, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{
        role: 'user',
        content:
          `PR: "${prTitle}"\n` +
          `Tier: ${tier.toUpperCase()}\n` +
          `Files changed:\n${filesSummary}\n` +
          deterministicNote +
          `\n---\n${truncatedDiff}`,
      }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  try {
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { architectural_concerns: [], warnings: [], summary: raw, lgtm: false };
  } catch {
    return { architectural_concerns: [], warnings: [], summary: raw, lgtm: false };
  }
}

// ─── Build review body ────────────────────────────────────────────────────────

function tierEmoji(tier) {
  return { red: '🔴', yellow: '🟡', green: '🟢' }[tier] ?? '⚪';
}

function buildReviewBody({ tier, decision, deterministicResult, llmResult, prTitle, isAdminMutation, truncated }) {
  const lines = [];
  const emoji = tierEmoji(tier);
  const decisionLine = decision === 'APPROVE'
    ? '✅ **APPROVED** — no constraint violations found'
    : '🚫 **CHANGES REQUESTED** — constraint violations must be resolved before merge';

  lines.push(`## 🏭 Factory Canonical Review`);
  lines.push('');
  lines.push(`**Tier:** ${emoji} ${tier.charAt(0).toUpperCase() + tier.slice(1)}`);
  lines.push(`**Decision:** ${decisionLine}`);
  lines.push('');

  // Violations
  const allViolations = [
    ...deterministicResult.violations,
    ...(llmResult?.architectural_concerns ?? []).map(c => ({ constraint: 'Architecture', detail: c.detail, file: c.file, line: c.line })),
  ];

  if (isAdminMutation) {
    lines.push('> ⚠️ **FRIDGE Rule 4:** This PR touches `/admin` mutation paths. Out-of-band CODEOWNER ✅ required even after this review approves.');
    lines.push('');
  }

  if (tier === 'red') {
    lines.push('> 🔴 **Red-tier PR.** This PR touches high-risk paths (workflows, packages, migrations, wrangler, capabilities). Review carefully before merging.');
    lines.push('');
  }

  if (allViolations.length > 0) {
    lines.push('### ❌ Violations (must fix before merge)');
    lines.push('');
    for (const v of allViolations) {
      const location = v.file ? ` · \`${v.file}${v.line ? `:${v.line}` : ''}\`` : '';
      lines.push(`- **${v.constraint}**${location}: ${v.detail}`);
    }
    lines.push('');
  }

  // Warnings
  const allWarnings = [
    ...deterministicResult.warnings,
    ...(llmResult?.warnings ?? []).map(w => ({ detail: w.detail, file: w.file })),
  ];

  if (allWarnings.length > 0) {
    lines.push('### ⚠️ Warnings (non-blocking)');
    lines.push('');
    for (const w of allWarnings) {
      const location = w.file ? ` · \`${w.file}\`` : '';
      lines.push(`- ${w.detail}${location}`);
    }
    lines.push('');
  }

  // Summary
  if (llmResult?.summary) {
    lines.push('### Summary');
    lines.push('');
    lines.push(llmResult.summary);
    lines.push('');
  }

  if (truncated) {
    lines.push('> ℹ️ Diff exceeded 28k chars — full diff was truncated. Large files may need manual spot-check.');
    lines.push('');
  }

  // Constraint checklist
  lines.push('<details><summary>Constraint checklist</summary>');
  lines.push('');
  lines.push('| Constraint | Status |');
  lines.push('|---|---|');
  const checks = [
    ['No process.env', deterministicResult.violations.some(v => v.constraint === 'No process.env')],
    ['No CommonJS require()', deterministicResult.violations.some(v => v.constraint === 'No CommonJS require()')],
    ['No Buffer', deterministicResult.violations.some(v => v.constraint === 'No Buffer')],
    ['No Node.js built-ins', deterministicResult.violations.some(v => v.constraint === 'No Node.js built-ins')],
    ['No Express/Fastify/Next', deterministicResult.violations.some(v => v.constraint === 'No Express/Fastify/Next')],
    ['No jsonwebtoken', deterministicResult.violations.some(v => v.constraint === 'No jsonwebtoken')],
    ['No secrets in wrangler vars', deterministicResult.violations.some(v => v.constraint === 'No secrets in wrangler vars')],
  ];
  for (const [name, violated] of checks) {
    lines.push(`| ${name} | ${violated ? '❌ FAIL' : '✅ Pass'} |`);
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');
  lines.push(`---`);
  lines.push(`_Factory Canonical Reviewer · [factory-cross-repo] · \`${PR_SHA?.slice(0, 7) ?? 'unknown'}\`_`);

  return lines.join('\n');
}

// ─── Post GitHub review ───────────────────────────────────────────────────────

async function postReview(event, body) {
  // event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  try {
    await gh('POST', `/repos/${ORG}/${repo}/pulls/${prNum}/reviews`, { event, body });
    console.log(`[OK] Posted ${event} review on ${repo}#${prNum}`);
  } catch (err) {
    // Approval may fail if the app lacks pull_requests:write — fall back to comment
    if (event === 'APPROVE' && err.message.includes('403')) {
      console.warn('[WARN] App lacks pull_requests:write — posting COMMENT instead of APPROVE');
      console.warn('[ACTION REQUIRED] Grant the factory-cross-repo GitHub App "Pull requests: Read and write" permission');
      await gh('POST', `/repos/${ORG}/${repo}/pulls/${prNum}/reviews`, {
        event: 'COMMENT',
        body: body + '\n\n> ⚠️ **Setup required:** Grant `factory-cross-repo` app `Pull requests: Read and write` to enable auto-approve.',
      });
    } else {
      throw err;
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[INFO] Reviewing ${repo}#${prNum} @ ${PR_SHA?.slice(0, 7)}`);

  // Fetch PR metadata
  const pr = await gh('GET', `/repos/${ORG}/${repo}/pulls/${prNum}`);

  // Don't review our own PRs (bot is the author)
  if (pr.user?.login === REVIEW_BOT_LOGIN) {
    console.log('[SKIP] PR authored by review bot — skipping self-review');
    return;
  }

  // Don't re-review if we already have a review on this exact commit
  const existingReviews = await gh('GET', `/repos/${ORG}/${repo}/pulls/${prNum}/reviews`);
  const alreadyReviewed = existingReviews.some(
    r => r.user?.login === REVIEW_BOT_LOGIN && r.commit_id === PR_SHA,
  );
  if (alreadyReviewed) {
    console.log('[SKIP] Already reviewed this commit');
    return;
  }

  // Fetch changed files
  const files = await gh('GET', `/repos/${ORG}/${repo}/pulls/${prNum}/files`);
  const filenames = files.map(f => f.filename);

  const tier = detectTier(filenames);
  const adminMutation = hasAdminMutation(filenames);
  const totalDiffChars = files.reduce((n, f) => n + (f.patch?.length ?? 0), 0);
  const truncated = totalDiffChars > MAX_DIFF_CHARS;

  console.log(`[INFO] Tier: ${tier} | Files: ${filenames.length} | Diff: ${totalDiffChars} chars | Admin: ${adminMutation}`);

  // Deterministic checks
  const addedLines = extractAddedLines(files);
  const deterministicResult = runDeterministicChecks(addedLines, filenames);

  console.log(`[INFO] Deterministic: ${deterministicResult.violations.length} violations, ${deterministicResult.warnings.length} warnings`);

  // Green tier with no violations → approve without LLM call
  let llmResult = null;
  if (tier === 'green' && deterministicResult.violations.length === 0 && !adminMutation) {
    console.log('[INFO] Green tier + no violations — skipping LLM call');
    llmResult = { architectural_concerns: [], warnings: [], summary: 'Green-tier change (docs/markdown only) — no architectural review required.', lgtm: true };
  } else {
    console.log('[INFO] Calling Claude for architectural review...');
    llmResult = await callClaude(pr.title, tier, files, deterministicResult.warnings);
    console.log(`[INFO] LLM: lgtm=${llmResult.lgtm} | concerns=${llmResult.architectural_concerns?.length ?? 0}`);
  }

  // Determine decision
  const hasViolations = deterministicResult.violations.length > 0 ||
    (llmResult.architectural_concerns?.length ?? 0) > 0;

  let decision;
  if (adminMutation) {
    // FRIDGE rule 4 — admin mutations always need explicit human ✅
    // We post a review flagging this but don't block (the FRIDGE rule is procedural, not a code violation)
    decision = hasViolations ? 'REQUEST_CHANGES' : 'COMMENT';
  } else if (hasViolations) {
    decision = 'REQUEST_CHANGES';
  } else {
    decision = 'APPROVE';
  }

  const body = buildReviewBody({
    tier,
    decision,
    deterministicResult,
    llmResult,
    prTitle: pr.title,
    isAdminMutation: adminMutation,
    truncated,
  });

  await postReview(decision, body);

  console.log(`[DONE] ${repo}#${prNum} → ${decision}`);
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
