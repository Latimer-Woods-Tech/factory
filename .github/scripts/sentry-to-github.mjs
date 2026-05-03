#!/usr/bin/env node
// sentry-to-github.mjs — Poll Sentry for new issues, create GitHub issues
// Runs via sentry-to-github.yml every 4h

const ORG_SLUG = 'latwood-tech';
const GH_ORG = 'Latimer-Woods-Tech';
const GH_REPO = 'factory';
const { GH_TOKEN, SENTRY_TOKEN, LOOKBACK_HOURS = '5' } = process.env;

const lookbackMs = parseInt(LOOKBACK_HOURS, 10) * 60 * 60 * 1000;
const since = new Date(Date.now() - lookbackMs).toISOString();

async function sentry(path) {
  const res = await fetch(`https://sentry.io/api/0${path}`, {
    headers: { Authorization: `Bearer ${SENTRY_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Sentry ${path} → ${res.status}`);
  return res.json();
}

async function ghPost(path, data) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GH ${path} → ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function ghSearch(query) {
  const res = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=5`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return { items: [] };
  return res.json();
}

const projects = await sentry(`/organizations/${ORG_SLUG}/projects/`);
console.log(`Scanning ${projects.length} projects for new issues since ${since}...`);

let created = 0, skipped = 0;

for (const project of projects) {
  const slug = project.slug;
  const issues = await sentry(
    `/projects/${ORG_SLUG}/${slug}/issues/?query=firstSeen%3A>${encodeURIComponent(since)}&limit=25`
  );

  for (const issue of issues) {
    const title = `[Sentry/${slug}] ${issue.title}`;
    const sentryUrl = `https://sentry.io/organizations/${ORG_SLUG}/issues/${issue.id}/`;

    const existing = await ghSearch(`repo:${GH_ORG}/${GH_REPO} ${issue.id} in:body label:source:sentry`);
    if (existing.items.length > 0) { skipped++; continue; }

    const body = [
      `**Sentry Issue:** [${issue.shortId}](${sentryUrl})`,
      `**Project:** ${slug}`,
      `**First seen:** ${issue.firstSeen}`,
      `**Occurrences:** ${issue.count}`,
      `**Level:** ${issue.level}`,
      '',
      '### Culprit',
      '`' + (issue.culprit || 'unknown') + '`',
      '',
      '### Metadata',
      '```json',
      JSON.stringify({ sentryId: issue.id, project: slug, firstSeen: issue.firstSeen }, null, 2),
      '```',
    ].join('\n');

    const priority = (issue.level === 'fatal' || issue.level === 'error') ? 'priority:P1' : 'priority:P2';

    await ghPost(`/repos/${GH_ORG}/${GH_REPO}/issues`, {
      title,
      body,
      labels: ['bug', priority, 'source:sentry', 'supervisor:approved-source'],
    });
    console.log(`✓ Created: ${slug}/${issue.shortId} — ${issue.title.slice(0, 60)}`);
    created++;
    await new Promise(r => setTimeout(r, 500));
  }
}

console.log(`\nDone. Created: ${created}, Skipped (existing): ${skipped}`);
