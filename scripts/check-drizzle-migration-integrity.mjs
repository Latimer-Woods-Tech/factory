#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const configFileNames = new Set([
  'drizzle.config.ts',
  'drizzle.config.js',
  'drizzle.config.mjs',
  'drizzle.config.cjs',
  'drizzle.config.mts',
  'drizzle.config.cts',
]);

const visited = new Set();
const drizzleConfigs = [];
const violations = [];

function walk(directory) {
  if (visited.has(directory)) {
    return;
  }
  visited.add(directory);

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (configFileNames.has(entry.name)) {
      drizzleConfigs.push(fullPath);
    }
  }
}

function findDuplicatePrefixes(sqlFiles) {
  const seen = new Map();
  for (const file of sqlFiles) {
    const prefix = file.match(/^(\d+)_/)?.[1];
    if (!prefix) {
      continue;
    }
    const existing = seen.get(prefix) ?? [];
    existing.push(file);
    seen.set(prefix, existing);
  }

  for (const [prefix, files] of seen.entries()) {
    if (files.length > 1) {
      violations.push(`duplicate Drizzle migration prefix ${prefix}: ${files.join(', ')}`);
    }
  }
}

function readJournalEntries(journalPath) {
  try {
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    return Array.isArray(journal.entries) ? journal.entries : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    violations.push(`${path.relative(root, journalPath)} is not valid JSON: ${message}`);
    return [];
  }
}

function validateMigrations(configPath) {
  const config = readFileSync(configPath, 'utf8');
  const outMatch = config.match(/\bout\s*:\s*['"]([^'"]+)['"]/);

  if (!outMatch) {
    console.log(`Skipping ${path.relative(root, configPath)} (no static out directory found).`);
    return;
  }

  const migrationsDir = path.resolve(path.dirname(configPath), outMatch[1]);
  if (!existsSync(migrationsDir) || !statSync(migrationsDir).isDirectory()) {
    console.log(
      `Skipping ${path.relative(root, configPath)} (missing migrations directory ${path.relative(root, migrationsDir)}).`,
    );
    return;
  }

  const sqlFiles = readdirSync(migrationsDir)
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();

  findDuplicatePrefixes(sqlFiles);

  const metaDir = path.join(migrationsDir, 'meta');
  const journalPath = path.join(metaDir, '_journal.json');
  if (!existsSync(journalPath)) {
    return;
  }

  const entries = readJournalEntries(journalPath);
  const sqlBasenames = new Set(sqlFiles.map((name) => name.replace(/\.sql$/, '')));
  const journalTags = new Set(entries.map((entry) => entry.tag).filter(Boolean));

  for (const tag of journalTags) {
    if (!sqlBasenames.has(tag)) {
      violations.push(`${path.relative(root, journalPath)} references missing migration ${tag}.sql`);
    }

    const prefix = tag.match(/^(\d+)_/)?.[1];
    if (!prefix) {
      continue;
    }

    const snapshotPath = path.join(metaDir, `${prefix}_snapshot.json`);
    if (!existsSync(snapshotPath)) {
      violations.push(
        `${path.relative(root, journalPath)} is missing snapshot ${path.relative(root, snapshotPath)}`,
      );
    }
  }

  for (const sqlBase of sqlBasenames) {
    if (!journalTags.has(sqlBase)) {
      violations.push(
        `${path.relative(root, configPath)} has migration ${sqlBase}.sql without a matching meta/_journal.json entry`,
      );
    }
  }
}

walk(root);

if (drizzleConfigs.length === 0) {
  console.log('No Drizzle config files found.');
  process.exit(0);
}

for (const configPath of drizzleConfigs) {
  validateMigrations(configPath);
}

if (violations.length > 0) {
  console.error('Drizzle migration integrity check failed.');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Drizzle migration integrity check passed for ${drizzleConfigs.length} config file(s).`);
