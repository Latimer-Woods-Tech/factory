#!/usr/bin/env node
/**
 * generate-supervisor-templates.mjs
 *
 * Reads every YAML file in docs/supervisor/plans/, validates the schema,
 * and emits apps/supervisor/src/planner/templates.generated.ts.
 *
 * Run: node scripts/generate-supervisor-templates.mjs
 * Wired as: "prebuild" in apps/supervisor/package.json
 *
 * This is the single source of truth for templates. Adding a new template
 * requires only a new YAML file — no other code changes.
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Resolve js-yaml from apps/supervisor/node_modules (where it's installed)
const require = createRequire(join(ROOT, 'apps', 'supervisor', 'package.json'));
const { load: yamlLoad } = require('js-yaml');
const PLANS_DIR = join(ROOT, 'docs', 'supervisor', 'plans');
const OUT_FILE = join(ROOT, 'apps', 'supervisor', 'src', 'planner', 'templates.generated.ts');

const VALID_TIERS = new Set(['green', 'yellow', 'red']);
const VALID_SIDE_EFFECTS = new Set(['none', 'read-external', 'write-app', 'write-external']);

function validate(parsed, file) {
  const errors = [];
  if (!parsed.id || typeof parsed.id !== 'string') errors.push('missing or invalid `id`');
  if (!VALID_TIERS.has(parsed.tier)) errors.push(`invalid tier "${parsed.tier}" — must be green|yellow|red`);
  if (!parsed.triggers) errors.push('missing `triggers` block');
  if (parsed.triggers) {
    if (!parsed.triggers.labels_any_of && !parsed.triggers.title_pattern) {
      errors.push('triggers must have at least one of: labels_any_of, title_pattern');
    }
    if (parsed.triggers.title_pattern) {
      try { new RegExp(parsed.triggers.title_pattern, 'i'); } catch (e) {
        errors.push(`triggers.title_pattern is not a valid regex: ${e.message}`);
      }
    }
    for (const p of (parsed.triggers.body_patterns ?? [])) {
      // Strip PCRE inline flags (?i), (?s), (?is) — JS regex doesn't support them inline;
      // matchTemplate applies the 'i' flag and we handle dotAll separately if needed.
      const jsPattern = p.replace(/^\(\?[is]+\)/, '');
      try { new RegExp(jsPattern, 'i'); } catch (e) {
        errors.push(`triggers.body_patterns entry is not a valid regex: ${p} — ${e.message}`);
      }
    }
  }
  if (parsed.steps) {
    for (const step of parsed.steps) {
      if (step.side_effects && !VALID_SIDE_EFFECTS.has(step.side_effects)) {
        errors.push(`step "${step.id ?? step.tool}" has invalid side_effects "${step.side_effects}"`);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`[${file}] validation failed:\n  - ${errors.join('\n  - ')}`);
  }
}

function deriveKeywords(parsed) {
  // Auto-derive trigger_keywords from labels, id segments, and description words
  const words = new Set();
  for (const label of (parsed.triggers?.labels_any_of ?? [])) {
    label.split(/[:\s,]+/).forEach((w) => w.length > 2 && words.add(w.toLowerCase()));
  }
  parsed.id.split(/[-_]+/).forEach((w) => w.length > 2 && words.add(w.toLowerCase()));
  (parsed.description ?? '').split(/\s+/).slice(0, 10).forEach((w) => {
    const clean = w.toLowerCase().replace(/[^a-z]/g, '');
    if (clean.length > 3) words.add(clean);
  });
  return [...words];
}

function buildTemplate(parsed) {
  const keywords = parsed.trigger_keywords ?? deriveKeywords(parsed);
  return {
    id: parsed.id,
    tier: parsed.tier,
    description: parsed.description ?? '',
    trigger_keywords: keywords,
    triggers: {
      ...(parsed.triggers.labels_any_of ? { labels_any_of: parsed.triggers.labels_any_of } : {}),
      ...(parsed.triggers.title_pattern ? { title_pattern: parsed.triggers.title_pattern } : {}),
      ...(parsed.triggers.body_patterns ? { body_patterns: parsed.triggers.body_patterns } : {}),
    },
    ...(parsed.steps ? {
      steps: parsed.steps.map((s) => ({
        tool: s.tool,
        ...(s.params ? { slots: s.params } : {}),
        side_effects: s.side_effects ?? 'none',
      })),
    } : {}),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

const files = readdirSync(PLANS_DIR)
  .filter((f) => f.endsWith('.yml'))
  .sort();

if (files.length === 0) {
  console.error(`[ERROR] No YAML files found in ${PLANS_DIR}`);
  process.exit(1);
}

const templates = [];
const errors = [];

for (const file of files) {
  const fullPath = join(PLANS_DIR, file);
  try {
    const raw = readFileSync(fullPath, 'utf8');
    const parsed = yamlLoad(raw);
    validate(parsed, file);
    templates.push(buildTemplate(parsed));
    console.log(`  ✓ ${file} → id=${parsed.id} tier=${parsed.tier}`);
  } catch (e) {
    errors.push(e.message);
    console.error(`  ✗ ${file}: ${e.message}`);
  }
}

if (errors.length > 0) {
  console.error(`\n[ERROR] ${errors.length} template(s) failed validation. Fix them before building.`);
  process.exit(1);
}

const generated = `// AUTO-GENERATED by scripts/generate-supervisor-templates.mjs
// DO NOT EDIT DIRECTLY — edit docs/supervisor/plans/*.yml instead,
// then run: node scripts/generate-supervisor-templates.mjs
//
// Generated: ${new Date().toISOString()}
// Source files: ${files.join(', ')}

import type { Template } from './load';

export const GENERATED_TEMPLATES: Template[] = ${JSON.stringify(templates, null, 2)};
`;

writeFileSync(OUT_FILE, generated, 'utf8');
console.log(`\n[OK] Wrote ${templates.length} templates → ${OUT_FILE.replace(ROOT, '.')}`);
