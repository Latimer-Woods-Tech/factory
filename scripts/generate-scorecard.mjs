#!/usr/bin/env node

/**
 * Weekly implementation scorecard generator.
 *
 * Reads initiative labels from GitHub issues and writes a markdown scorecard.
 * Posts a summary to Slack.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const ORG = process.env.SCORECARD_REPO_OWNER || 'Latimer-Woods-Tech';
const REPO = process.env.SCORECARD_REPO_NAME || 'factory';

if (!GITHUB_TOKEN || !SLACK_WEBHOOK_URL) {
  console.error('Missing required environment variables: GITHUB_TOKEN, SLACK_WEBHOOK_URL');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
};

const TRACK_INITIATIVES = {
  T1: ['T1.1', 'T1.2', 'T1.3', 'T1.4'],
  T2: ['T2.1', 'T2.2', 'T2.3', 'T2.4'],
  T3: ['T3.1', 'T3.2', 'T3.3', 'T3.4'],
  T4: ['T4.1', 'T4.2', 'T4.3', 'T4.4'],
  T5: ['T5.1', 'T5.2', 'T5.3', 'T5.4'],
  T6: ['T6.1', 'T6.2', 'T6.3', 'T6.4'],
  T7: ['T7.1', 'T7.2', 'T7.3', 'T7.4'],
};

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function getIssueForLabel(label) {
  const url = `https://api.github.com/repos/${ORG}/${REPO}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=1`;
  const issues = await fetchJson(url);
  return issues.length ? issues[0] : null;
}

function normalizeOwner(issue) {
  if (issue.assignee?.login) {
    return issue.assignee.login;
  }
  const match = issue.body?.match(/Owner:\s*(.+)/i);
  return match ? match[1].trim() : 'TBD';
}

function parseProgress(issue) {
  const match = issue.body?.match(/Progress:\s*(\d+)%/i);
  if (!match) return 0;
  return Number(match[1]);
}

function initiativeStatus(issue, progress) {
  if (!issue) return '❓ Not Found';
  if (issue.state === 'closed') return '✅ Done';
  if (progress >= 90) return '🟢 Final';
  if (progress >= 50) return '🟡 In Progress';
  if (progress > 0) return '🟠 Started';
  return '⚪ Planned';
}

function trackSummary(trackInitiatives) {
  const total = trackInitiatives.length;
  const done = trackInitiatives.filter(i => i.status === '✅ Done').length;
  const avgProgress = Math.round(
    trackInitiatives.reduce((sum, i) => sum + i.progress, 0) / total,
  );
  return { total, done, avgProgress, progress: `${done}/${total}`, status: done === total ? '✅' : avgProgress >= 75 ? '🟡' : '⚪' };
}

function generateMarkdown(initiatives, summaries) {
  let md = `# Implementation Scorecard\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `## Portfolio Status\n\n`;
  md += `| Track | Progress | Avg % | Status |\n`;
  md += `|-------|----------|-------|--------|\n`;
  for (const track of Object.keys(TRACK_INITIATIVES)) {
    const summary = summaries[track];
    md += `| ${track} | ${summary.progress} | ${summary.avgProgress}% | ${summary.status} |\n`;
  }
  md += `\n## Detailed Status\n\n`;
  for (const track of Object.keys(TRACK_INITIATIVES)) {
    md += `### ${track}\n\n`;
    md += `| Initiative | Status | Progress | Owner | Completion |\n`;
    md += `|-----------|--------|----------|-------|------------|\n`;
    for (const initiative of initiatives[track]) {
      md += `| ${initiative.code} | ${initiative.status} | ${initiative.progress}% | ${initiative.owner} | ${initiative.completionDate || '-'} |\n`;
    }
    md += `\n`;
  }
  return md;
}

function formatSlackMessage(summaries) {
  const totalInitiatives = Object.values(summaries).reduce((sum, track) => sum + track.total, 0);
  const totalDone = Object.values(summaries).reduce((sum, track) => sum + track.done, 0);
  const overall = Math.round((totalDone / totalInitiatives) * 100);

  return {
    text: 'Weekly Implementation Scorecard',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*Implementation Scorecard — ${new Date().toLocaleDateString()}*` } },
      { type: 'section', text: { type: 'mrkdwn', text: `Overall progress: *${totalDone}/${totalInitiatives}* initiatives (${overall}%)` } },
      { type: 'section', text: { type: 'mrkdwn', text: Object.entries(summaries)
          .map(([track, summary]) => `*${track}* — ${summary.progress}, ${summary.avgProgress}% ${summary.status}`)
          .join('\n') } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Repo: ${ORG}/${REPO}` }] },
    ],
  };
}

async function postSlackMessage(payload) {
  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Slack post failed ${response.status}: ${await response.text()}`);
  }
}

async function writeMarkdown(markdown) {
  const fs = await import('fs/promises');
  await fs.writeFile('docs/IMPLEMENTATION_SCORECARD_AUTO.md', markdown, 'utf8');
}

async function main() {
  try {
    const initiatives = {};
    for (const [track, codes] of Object.entries(TRACK_INITIATIVES)) {
      initiatives[track] = [];
      for (const code of codes) {
        const issue = await getIssueForLabel(code);
        const progress = issue ? parseProgress(issue) : 0;
        initiatives[track].push({
          code,
          status: initiativeStatus(issue, progress),
          progress,
          owner: issue ? normalizeOwner(issue) : 'TBD',
          completionDate: issue?.closed_at ? issue.closed_at.split('T')[0] : null,
        });
      }
    }
    const summaries = Object.fromEntries(Object.entries(initiatives).map(([track, list]) => [track, trackSummary(list)]));
    const markdown = generateMarkdown(initiatives, summaries);
    await writeMarkdown(markdown);
    await postSlackMessage(formatSlackMessage(summaries));
    console.log('✅ Scorecard generated and posted to Slack.');
    process.exit(0);
  } catch (error) {
    console.error('Error generating scorecard:', error);
    process.exit(1);
  }
}

main();
