# T6.4 & T7.3 — KPI & Scorecard Automation Scripts

**Last Updated:** April 28, 2026  
**Phase:** Phase 4 (Automation Ready)  
**Status:** Scripts scaffolded; ready for May 1–5 integration

---

## T6.4 — KPI Automation Script

**Goal:** Weekly automated KPI reporting (lead time, deployment frequency, change failure rate, MTTR) to Slack

**File:** `scripts/track-delivery-metrics.mjs`

```javascript
#!/usr/bin/env node

/**
 * Track Delivery KPIs (DORA metrics)
 *
 * Queries GitHub API to extract:
 * 1. Lead time: time from first commit to deployment
 * 2. Deployment frequency: deploys per week
 * 3. Change failure rate: % of deployments causing incidents
 * 4. MTTR: Mean time to recovery from failures
 *
 * Reports to Slack every Monday 10:00 UTC
 */

import * as fs from 'fs';
import { Octokit } from '@octokit/rest';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const ORG = 'adrper79-dot';
const REPO = 'factory';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * METRIC 1: Lead Time (days from first commit to deployment)
 */
async function getLeadTime() {
  // Query: closed PRs with label "deployed" + merge date
  //        Find first commit date + deployment date
  //        Calculate delta
  
  const query = `
    query {
      repository(owner: "${ORG}", name: "${REPO}") {
        pullRequests(last: 50, states: MERGED) {
          edges {
            node {
              title
              mergedAt
              commits(last: 1) {
                edges {
                  node {
                    committedDate
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const response = await octokit.graphql(query);
  const prs = response.repository.pullRequests.edges;
  
  const leadTimes = prs
    .filter(edge => edge.node.mergedAt)
    .map(edge => {
      const firstCommit = edge.node.commits.edges[0].node.committedDate;
      const merged = edge.node.mergedAt;
      const days = Math.round(
        (new Date(merged) - new Date(firstCommit)) / (1000 * 60 * 60 * 24)
      );
      return days;
    });
  
  const avg = Math.round(
    leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
  );
  
  return {
    value: avg,
    unit: 'days',
    target: 14, // <2 weeks is good
    status: avg <= 14 ? 'on-track' : 'at-risk'
  };
}

/**
 * METRIC 2: Deployment Frequency (deploys per week)
 */
async function getDeploymentFrequency() {
  // Query: releases (tags) created in last 7 days
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const releases = await octokit.repos.listReleases({
    owner: ORG,
    repo: REPO,
    per_page: 100,
  });
  
  const thisWeek = releases.data.filter(
    r => new Date(r.created_at) > lastWeek
  );
  
  return {
    value: thisWeek.length,
    unit: 'deploys/week',
    target: 1, // At least 1 deploy per week
    status: thisWeek.length >= 1 ? 'on-track' : 'at-risk'
  };
}

/**
 * METRIC 3: Change Failure Rate (% of deploys causing incidents)
 */
async function getChangeFailureRate() {
  // Query: relates to T5 incident tracking
  // Get incidents from past week
  // Calculate: failures / total_deploys
  
  const incidents = await fetch(`${process.env.INCIDENT_TRACKER_API}/incidents`, {
    headers: { Authorization: `Bearer ${process.env.INCIDENT_TRACKER_TOKEN}` }
  }).then(r => r.json());
  
  const deployments = await getDeploymentFrequency();
  const failuresThisWeek = incidents.filter(
    i => new Date(i.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;
  
  const rate = deployments.value > 0
    ? Math.round((failuresThisWeek / deployments.value) * 100)
    : 0;
  
  return {
    value: rate,
    unit: '%',
    target: 5, // <5% is healthy
    status: rate <= 5 ? 'on-track' : 'at-risk'
  };
}

/**
 * METRIC 4: MTTR (Mean Time To Recovery)
 */
async function getMTTR() {
  // Query: incidents with 'resolved_at' time
  // Calculate: avg(resolved_at - created_at)
  
  const incidents = await fetch(`${process.env.INCIDENT_TRACKER_API}/incidents`, {
    headers: { Authorization: `Bearer ${process.env.INCIDENT_TRACKER_TOKEN}` }
  }).then(r => r.json());
  
  const thisMonth = incidents.filter(
    i => new Date(i.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  
  const mttrMins = thisMonth
    .filter(i => i.resolved_at)
    .map(i => {
      const duration = new Date(i.resolved_at) - new Date(i.created_at);
      return Math.round(duration / (1000 * 60)); // Convert to minutes
    });
  
  const avg = mttrMins.length > 0
    ? Math.round(mttrMins.reduce((a, b) => a + b, 0) / mttrMins.length)
    : 0;
  
  return {
    value: avg,
    unit: 'minutes',
    target: 30, // <30 min is good
    status: avg <= 30 ? 'on-track' : 'at-risk'
  };
}

/**
 * Format metrics for Slack
 */
function formatSlackMessage(metrics) {
  const fields = [
    {
      title: 'Lead Time',
      value: `${metrics.leadTime.value} ${metrics.leadTime.unit}`,
      color: metrics.leadTime.status === 'on-track' ? '#36a64f' : '#ff0000'
    },
    {
      title: 'Deployment Frequency',
      value: `${metrics.deploymentFrequency.value} ${metrics.deploymentFrequency.unit}`,
      color: metrics.deploymentFrequency.status === 'on-track' ? '#36a64f' : '#ff0000'
    },
    {
      title: 'Change Failure Rate',
      value: `${metrics.changeFailureRate.value}${metrics.changeFailureRate.unit}`,
      color: metrics.changeFailureRate.status === 'on-track' ? '#36a64f' : '#ff0000'
    },
    {
      title: 'MTTR',
      value: `${metrics.mttr.value} ${metrics.mttr.unit}`,
      color: metrics.mttr.status === 'on-track' ? '#36a64f' : '#ff0000'
    },
  ];
  
  return {
    text: 'Weekly Delivery KPIs',
    attachments: [
      {
        color: '#0099ff',
        title: 'DORA Metrics — Week of ' + new Date().toLocaleDateString(),
        fields: fields.map(f => ({
          title: f.title,
          value: f.value,
          short: true
        })),
        footer: 'Factory Delivery Dashboard',
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  };
}

/**
 * Main
 */
async function main() {
  console.log('📊 Tracking delivery metrics...');
  
  const metrics = {
    leadTime: await getLeadTime(),
    deploymentFrequency: await getDeploymentFrequency(),
    changeFailureRate: await getChangeFailureRate(),
    mttr: await getMTTR(),
    timestamp: new Date().toISOString(),
  };
  
  console.log('Metrics:', JSON.stringify(metrics, null, 2));
  
  // Post to Slack
  const message = formatSlackMessage(metrics);
  
  const res = await fetch(SLACK_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
  
  if (res.ok) {
    console.log('✅ Posted to Slack');
  } else {
    console.error('❌ Failed to post to Slack:', res.status, res.statusText);
    process.exit(1);
  }
  
  // Also save to CSV for historical tracking
  const csv = `${metrics.timestamp},${metrics.leadTime.value},${metrics.deploymentFrequency.value},${metrics.changeFailureRate.value},${metrics.mttr.value}\n`;
  fs.appendFileSync('kpi-history.csv', csv);
  
  console.log('✅ Metrics saved to kpi-history.csv');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
```

**Execution:** Run every Monday 10:00 UTC via GitHub Actions

**File:** `.github/workflows/track-kpis.yml`

```yaml
name: Track Delivery KPIs
on:
  schedule:
    - cron: '0 10 * * 1'  # Every Monday at 10:00 UTC
  
jobs:
  track-kpis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm install @octokit/rest
      
      - name: Track metrics
        run: node scripts/track-delivery-metrics.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_DELIVERY_KPIs }}
          INCIDENT_TRACKER_API: https://incidents.factory.local/api
          INCIDENT_TRACKER_TOKEN: ${{ secrets.INCIDENT_TRACKER_TOKEN }}
      
      - name: Commit kpi-history.csv
        run: |
          git add kpi-history.csv
          git commit -m "chore: update KPI history" || true
          git push
```

---

## T7.3 — Scorecard Automation Script

**Goal:** Weekly automated scorecard generation from GitHub Issues

**File:** `scripts/generate-scorecard.mjs`

```javascript
#!/usr/bin/env node

/**
 * Generate Implementation Scorecard from GitHub Issues
 *
 * Queries GitHub for issues labeled with initiative codes (T1.1, T1.2, etc.)
 * Extracts: status, progress %, owner, completion date
 * Generates markdown scorecard with Slack posting
 */

import * as fs from 'fs';
import { Octokit } from '@octokit/rest';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const ORG = 'adrper79-dot';
const REPO = 'factory';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const TRACK_INITIATIVES = {
  'T1': ['T1.1', 'T1.2', 'T1.3', 'T1.4'],
  'T2': ['T2.1', 'T2.2', 'T2.3', 'T2.4'],
  'T3': ['T3.1', 'T3.2', 'T3.3', 'T3.4'],
  'T4': ['T4.1', 'T4.2', 'T4.3', 'T4.4'],
  'T5': ['T5.1', 'T5.2', 'T5.3', 'T5.4'],
  'T6': ['T6.1', 'T6.2', 'T6.3', 'T6.4'],
  'T7': ['T7.1', 'T7.2', 'T7.3', 'T7.4'],
};

/**
 * Get status of a single initiative from GitHub issue
 */
async function getInitiativeStatus(code) {
  const issues = await octokit.issues.listForRepo({
    owner: ORG,
    repo: REPO,
    labels: code,
    per_page: 1,
  });
  
  if (issues.data.length === 0) {
    return {
      code,
      status: '❓ Not Found',
      progress: 0,
      owner: 'TBD',
      completionDate: null,
    };
  }
  
  const issue = issues.data[0];
  const body = issue.body || '';
  
  // Parse body for progress (expected format: `Progress: 90%`)
  const progressMatch = body.match(/Progress:\s*(\d+)%/);
  const progress = progressMatch ? parseInt(progressMatch[1]) : 0;
  
  // Determine status from progress + issue state
  let status;
  if (issue.state === 'closed') {
    status = '✅ Done';
  } else if (progress >= 75) {
    status = '🟡 Final';
  } else if (progress >= 50) {
    status = '🟠 In Progress';
  } else {
    status = '⚪ Planned';
  }
  
  // Extract owner from assignee or body
  const owner = issue.assignee?.login || issue.body?.match(/Owner: (.+)/)?.[1] || 'TBD';
  
  // Extract completion date if closed
  const completionDate = issue.closed_at ? issue.closed_at.split('T')[0] : null;
  
  return {
    code,
    status,
    progress,
    owner,
    completionDate,
  };
}

/**
 * Get all initiatives + aggregate by track
 */
async function getAllInitiatives() {
  const initiatives = {};
  
  for (const [track, codes] of Object.entries(TRACK_INITIATIVES)) {
    initiatives[track] = [];
    for (const code of codes) {
      const status = await getInitiativeStatus(code);
      initiatives[track].push(status);
    }
  }
  
  return initiatives;
}

/**
 * Calculate track summaries
 */
function calculateTrackSummaries(initiatives) {
  const summaries = {};
  
  for (const [track, inits] of Object.entries(initiatives)) {
    const total = inits.length;
    const done = inits.filter(i => i.status === '✅ Done').length;
    const avgProgress = Math.round(
      inits.reduce((sum, i) => sum + i.progress, 0) / total
    );
    
    summaries[track] = {
      total,
      done,
      progress: `${done}/${total}`,
      avgProgress,
      status: done === total ? '✅' : avgProgress >= 75 ? '🟡' : '⚪'
    };
  }
  
  return summaries;
}

/**
 * Generate markdown scorecard
 */
function generateMarkdown(initiatives, summaries) {
  let md = `# Implementation Scorecard
  
**Last Updated:** ${new Date().toISOString()}  
**Generated:** Automated from GitHub Issues

## Portfolio Status

| Track | Progress | Avg % | Status |
|-------|----------|-------|--------|
`;
  
  for (const [track, summary] of Object.entries(summaries)) {
    md += `| **${track}** | ${summary.progress} | ${summary.avgProgress}% | ${summary.status} |\n`;
  }
  
  md += `\n## Detailed Status\n\n`;
  
  for (const [track, inits] of Object.entries(initiatives)) {
    md += `### Track ${track}\n\n`;
    md += `| Initiative | Status | Progress | Owner | Completion |\n`;
    md += `|-----------|--------|----------|-------|-------------|\n`;
    for (const init of inits) {
      md += `| ${init.code} | ${init.status} | ${init.progress}% | ${init.owner} | ${init.completionDate || '-'} |\n`;
    }
    md += `\n`;
  }
  
  return md;
}

/**
 * Format for Slack
 */
function formatSlackMessage(summaries) {
  const totalDone = Object.values(summaries).reduce((s, t) => s + t.done, 0);
  const totalInit = Object.values(summaries).reduce((s, t) => s + t.total, 0);
  const overallPercent = Math.round((totalDone / totalInit) * 100);
  
  return {
    text: 'Weekly Implementation Scorecard',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Implementation Scorecard — Week of ' + new Date().toLocaleDateString(),
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Overall Progress:* ${totalDone}/${totalInit} initiatives (${overallPercent}%)\n\n` +
                Object.entries(summaries)
                  .map(([track, s]) => `*${track}*: ${s.progress} (${s.avgProgress}%) ${s.status}`)
                  .join('\n'),
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Full Scorecard',
            },
            url: 'https://github.com/adrper79-dot/factory/blob/main/IMPLEMENTATION_SCORECARD.md',
          },
        ],
      },
    ],
  };
}

/**
 * Main
 */
async function main() {
  console.log('📊 Generating implementation scorecard...');
  
  const initiatives = await getAllInitiatives();
  console.log('✅ Fetched all initiatives');
  
  const summaries = calculateTrackSummaries(initiatives);
  const markdown = generateMarkdown(initiatives, summaries);
  
  // Write updated scorecard to file
  fs.writeFileSync('docs/IMPLEMENTATION_SCORECARD_AUTO.md', markdown);
  console.log('✅ Wrote scorecard to docs/IMPLEMENTATION_SCORECARD_AUTO.md');
  
  // Post to Slack
  const message = formatSlackMessage(summaries);
  const res = await fetch(SLACK_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  
  if (res.ok) {
    console.log('✅ Posted scorecard to Slack');
  } else {
    console.error('❌ Failed to post to Slack:', res.status);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
```

**Execution:** Run every Monday 11:00 UTC via GitHub Actions

**File:** `.github/workflows/generate-scorecard.yml`

```yaml
name: Generate Implementation Scorecard
on:
  schedule:
    - cron: '0 11 * * 1'  # Every Monday at 11:00 UTC
  
jobs:
  scorecard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm install @octokit/rest
      
      - name: Generate scorecard
        run: node scripts/generate-scorecard.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_SCORECARD }}
      
      - name: Commit scorecard
        run: |
          git add docs/IMPLEMENTATION_SCORECARD_AUTO.md
          git commit -m "chore: update implementation scorecard" || true
          git push
```

---

## Exit Criteria

**T6.4 & T7.3 complete when:**

✅ `track-delivery-metrics.mjs` implemented + tested  
✅ `.github/workflows/track-kpis.yml` running + posting to Slack  
✅ `generate-scorecard.mjs` implemented + tested  
✅ `.github/workflows/generate-scorecard.yml` running + posting to Slack  
✅ Both scripts run successfully (manual test runs passed)  
✅ Slack channels receiving weekly reports  
✅ CSV/markdown output files created + accurate  
✅ Documentation: README for running scripts locally

---

## Related Docs

- [Delivery KPIs](docs/dashboards/delivery-kpis-template.yaml) — Metrics definitions
- [Implementation Scorecard](docs/IMPLEMENTATION_SCORECARD.md) — Manual version
- [IMPLEMENTATION_SCORECARD_AUTO.md](docs/IMPLEMENTATION_SCORECARD_AUTO.md) — Auto-generated
- [IMPLEMENTATION_MASTER_INDEX.md](docs/IMPLEMENTATION_MASTER_INDEX.md) — Overview
