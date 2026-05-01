# Delivery KPI Dashboard: DORA Metrics + Incident Tracking

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T6.4 — Track delivery KPIs for continuous improvement  
**Scope:** Define DORA metrics (NIST), dashboard UI, weekly collection process, alert thresholds

---

## Executive Summary

**Problem:** Team doesn't have visibility into deployment health:
- How often do we deploy to production?
- How long does a feature take from PR to shipped?
- What % of deployments fail?
- How quickly do we recover from incidents?

**Solution:** Weekly automated collection of DORA metrics + incident data + simple dashboard view.

**Result by May 22:**
- ✅ Deployment frequency tracked (target: 2+ per week)
- ✅ Lead time measured (target: <3 days PR-to-prod)
- ✅ Change failure rate monitored (target: <15%)
- ✅ MTTR (mean time to recovery) recorded (target: <30 min for P1)
- ✅ Weekly dashboard update (automated)
- ✅ Alert when metrics trend negative

---

## Part 1: DORA Metrics Definitions

### Metric 1: Deployment Frequency

**Question:** How often does the team successfully deploy to production?

**Calculation:**
```
Deployments per week = COUNT(releases with status='completed' AND environment='production')
                      / 7 days
```

**Target:** 2+ deployments per week (at least one per day on average)

**Why It Matters:** Frequent, small deployments = lower risk per deploy; faster feedback

**Data Source:** GitHub releases tagged + pushed to `main` → linked to Cloudflare deploy logs

```sql
-- Query
SELECT 
  DATE_TRUNC('week', created_at) AS week,
  COUNT(*) AS deployment_count,
  COUNT(*)::FLOAT / 7 AS deployments_per_day
FROM deployments
WHERE environment = 'production'
  AND status = 'succeeded'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC
LIMIT 12;  -- Last 12 weeks
```

### Metric 2: Lead Time for Changes

**Question:** How long does it take from PR open to code in production?

**Calculation:**
```
Lead time = time(PR merged to main) - time(PR created)
          + time(deployed to production) - time(merged to main)
```

**Breakdown:**
1. **Code review cycle:** PR created → PR merged (median)
2. **Deploy lag:** PR merged → deployed to production (median)
3. **Total:** Review cycle + deploy lag

**Target:** <3 days median (P50); <5 days 95th percentile (P95)

**Why It Matters:** Short lead times = team feedback loops fast; can respond to production issues quickly

**Data Source:** GitHub PR metadata + Cloudflare deployment timestamps

```sql
-- Query
SELECT 
  DATE_TRUNC('week', pr_merged_at) AS week,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (pr_deployed_at - pr_created_at))
    AS lead_time_median,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (pr_deployed_at - pr_created_at))
    AS lead_time_p95,
  COUNT(*) AS pr_count
FROM pull_requests
WHERE pr_merged_at IS NOT NULL
  AND pr_deployed_at IS NOT NULL
  AND environment = 'production'
GROUP BY DATE_TRUNC('week', pr_merged_at)
ORDER BY week DESC
LIMIT 12;
```

**Interpretation:**
- Lead time <1 day: Elite performer 🏆
- Lead time 1–3 days: High performer ✅
- Lead time 3–6 months: Low performer ⚠️

### Metric 3: Change Failure Rate

**Question:** What % of deployments cause an incident?

**Calculation:**
```
Change failure rate = COUNT(deployments causing incidents)
                    / COUNT(total deployments to production)
                    × 100%
```

**Definition of "incident":** Any P1 or P2 severity alert within 1h of deployment

**Target:** <15% (ideally <10%)

**Why It Matters:** Measures quality/testing rigor; prevents cascading failures

**Data Source:** Link deployments to incidents via timestamp + Sentry tags

```sql
-- Query
SELECT 
  DATE_TRUNC('week', d.created_at) AS week,
  COUNT(d.id) AS deployment_count,
  COUNT(DISTINCT CASE 
    WHEN i.severity IN ('P1', 'P2') 
      AND i.created_at <= d.created_at + INTERVAL 1 HOUR
    THEN d.id 
  END) AS deployments_with_incidents,
  COUNT(DISTINCT CASE 
    WHEN i.severity IN ('P1', 'P2')
      AND i.created_at <= d.created_at + INTERVAL 1 HOUR
    THEN d.id
  END)::FLOAT / COUNT(d.id) * 100 AS failure_rate_pct
FROM deployments d
LEFT JOIN incidents i ON i.deployment_id = d.id
WHERE d.environment = 'production'
  AND d.status = 'succeeded'
GROUP BY DATE_TRUNC('week', d.created_at)
ORDER BY week DESC
LIMIT 12;
```

**Interpretation:**
- <15%: Acceptable (some failures expected)
- 15–30%: Needs attention (increase testing/QA)
- >30%: Critical (pause feature deploys; focus on stability)

### Metric 4: Mean Time To Recovery (MTTR)

**Question:** How quickly do we recover from production incidents?

**Calculation:**
```
MTTR = (incident_resolved_at - incident_detected_at)
       Average across all P1/P2 incidents per week
```

**Target:** <30 min for P1; <2 hours for P2

**Why It Matters:** Measures operational excellence; incident response rigor

**Data Source:** Sentry/Slack incident tracking (start time → resolution time)

```sql
-- Query
SELECT 
  DATE_TRUNC('week', detected_at) AS week,
  severity,
  COUNT(*) AS incident_count,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY resolved_at - detected_at)
    AS mttr_median,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY resolved_at - detected_at)
    AS mttr_p95,
  MAX(resolved_at - detected_at) AS mttr_max
FROM incidents
WHERE severity IN ('P1', 'P2')
GROUP BY DATE_TRUNC('week', detected_at), severity
ORDER BY week DESC, severity
LIMIT 24;  -- Last 12 weeks × 2 severities
```

---

## Part 2: Supporting Metrics

### Incident Tracking

```sql
-- Weekly incident summary
SELECT 
  DATE_TRUNC('week', detected_at) AS week,
  COUNT(*) AS incident_count,
  COUNT(*) FILTER (WHERE severity = 'P1') AS p1_count,
  COUNT(*) FILTER (WHERE severity = 'P2') AS p2_count,
  COUNT(*) FILTER (WHERE rootcause LIKE '%deploy%') AS deploy_related,
  COUNT(*) FILTER (WHERE rootcause LIKE '%database%') AS db_related
FROM incidents
GROUP BY DATE_TRUNC('week', detected_at)
ORDER BY week DESC
LIMIT 12;
```

### Rollback Rate

**Question:** How many deployments were rolled back?

**Calculation:**
```
Rollback rate = COUNT(deployments with status='rolled_back') 
              / COUNT(total deployments)
              × 100%
```

**Target:** <5% (fewer than 1 in 20 deployments)

```sql
SELECT 
  DATE_TRUNC('week', created_at) AS week,
  COUNT(*) AS total_deploys,
  COUNT(*) FILTER (WHERE status = 'rolled_back') AS rollback_count,
  COUNT(*) FILTER (WHERE status = 'rolled_back')::FLOAT / COUNT(*) * 100 AS rollback_pct
FROM deployments
WHERE environment = 'production'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC
LIMIT 12;
```

### Code Review Velocity

**Question:** How long do PRs sit in review before merge?

**Target:** <24 hours median (P50); <48 hours P95

```sql
SELECT 
  DATE_TRUNC('week', merged_at) AS week,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY merged_at - created_at) AS review_time_p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY merged_at - created_at) AS review_time_p95,
  COUNT(*) AS pr_count
FROM pull_requests
WHERE merged_at IS NOT NULL
GROUP BY DATE_TRUNC('week', merged_at)
ORDER BY week DESC
LIMIT 12;
```

---

## Part 3: Dashboard UI Layout

### Weekly Dashboard (1 screen)

```
┌────────────────────────────────────────────────────────────┐
│                   DELIVERY KPI DASHBOARD                   │
│                   Week of April 21–27, 2026                │
└────────────────────────────────────────────────────────────┘

┌─── DORA METRICS ─────────────────────────────────────────┐
│                                                            │
│  📦 Deployment Frequency      🟢 2.3 per week             │
│     Target: ≥2.0              Trend: ↗ +0.3 vs last week  │
│                                                            │
│  ⏱️  Lead Time for Changes     🟢 2.1 days (median)        │
│     Target: <3.0 days         P95: 4.2 days               │
│     Trend: ↘ -0.2 days (improving)                        │
│                                                            │
│  🚨 Change Failure Rate       🟡 12% (1 of 8 deploys)     │
│     Target: <15%              Trend: ↗ (was 8% last week) │
│     1 incident: DB timeout 1h after deploy                │
│                                                            │
│  ⚡ Mean Time to Recovery      🟢 18 min (P1 median)       │
│     Target P1: <30 min        P2: 1.2 hours               │
│     Trend: ↘ (improving)                                  │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌─── SUPPORTING METRICS ───────────────────────────────────┐
│                                                            │
│  Incidents This Week:                                    │
│    🔴 P1: 1 (DB timeout)          MTTR: 18 min          │
│    🟠 P2: 2 (latency, queue)       MTTR: 1.2h, 45min     │
│    🟡 P3: 3 (UI glitches)          No SLA                 │
│                                                            │
│  Code Review:                                             │
│    📋 PR Count: 8                 Median review: 22h      │
│    ✅ Merged: 8                   P95: 36h                │
│    🔄 In Review: 2                (within target <48h)    │
│                                                            │
│  Deployments:                                             │
│    🚀 Success: 8                  Rollback: 0 (0% rate)   │
│    ⚠️  Canary-only: 1             (monitoring 1h)         │
│    ❌ Failed: 0                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌─── TRENDS (Last 12 Weeks) ───────────────────────────────┐
│                                                            │
│ Deployment Freq:  ████ 2.1 ████ 2.0 ████ 1.8 ▂▂▂ ...   │
│ Lead Time:        ▂▂▂ 3.2d ████ 2.1d ████ 2.3d ████ ...  │
│ Failure Rate:     ████ 8% ░░░░ 10% ░░░░ 12% ...        │
│ MTTR (P1):        ▂▂▂ 45m ████ 20m ████ 18m ████ ...    │
│                                                            │
└────────────────────────────────────────────────────────────┘

🎯 STATUS: On Track  |  ⚠️  Watch: Failure rate trending up  |  ✅ Lead time improving
```

---

## Part 4: Collection & Automation

### Weekly Data Collection (Every Monday 09:00 UTC)

```typescript
// scripts/collect-kpis.ts
import { env } from 'env';
import { collectDeploymentStats } from './collectors/github';
import { collectIncidentData } from './collectors/sentry';
import { calculateMetrics } from './calculations/dora';
import { publishDashboard } from './publishers/notion';

export async function collectWeeklyKPIs() {
  const weekStart = getLastMonday();
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  console.log(`Collecting KPIs for week: ${weekStart} to ${weekEnd}`);

  // 1. GitHub data: deployments, PRs, reviews
  const deployments = await collectDeploymentStats(env.GITHUB_TOKEN, {
    owner: 'Latimer-Woods-Tech',
    repo: 'factory',
    dateRange: [weekStart, weekEnd],
  });

  // 2. Sentry data: incidents, MTTR
  const incidents = await collectIncidentData(env.SENTRY_API_KEY, {
    org: 'factory',
    project: 'videoking',
    dateRange: [weekStart, weekEnd],
  });

  // 3. Calculate DORA metrics
  const metrics = calculateMetrics({
    deployments,
    incidents,
    weekStart,
    weekEnd,
  });

  // 4. Publish to dashboard (Notion / Slack)
  await publishDashboard({
    metrics,
    timestamp: new Date(),
    channel: '#metrics',
  });

  console.log('✅ KPIs collected and published');
  return metrics;
}
```

### GitHub Actions Workflow

```yaml
# .github/workflows/collect-kpis.yml
name: Collect Weekly KPIs

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday 09:00 UTC

jobs:
  collect-kpis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Collect KPIs
        run: npm run collect:kpis
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SENTRY_API_KEY: ${{ secrets.SENTRY_API_KEY }}
          NOTION_API_KEY: ${{ secrets.NOTION_API_KEY }}
      
      - name: Update Dashboard
        run: npm run publish:kpi-dashboard
      
      - name: Post to Slack
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "📊 Weekly KPIs collected",
              "blocks": [
                {
                  "type": "section",
                  "text": { "type": "mrkdwn", "text": "Check the dashboard for trends" }
                }
              ]
            }
```

---

## Part 5: Alert Thresholds

### When to Alert (Slack #metrics)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Deployment Freq | <1.0 per week | 🟡 Warning: Deployments slowing down |
| Lead Time (P95) | >5 days | 🟡 Warning: Review process bottleneck |
| Change Failure Rate | >20% | 🔴 Critical: Quality crisis; pause features |
| MTTR (P1) | >1 hour | 🟡 Warning: Incident response slow; analyze root cause |
| MTTR (P2) | >4 hours | 🟡 Warning: P2 response time elevated |
| Rollback Rate | >10% | 🔴 Critical: Deployment reliability issue |
| PR Review Time (median) | >48 hours | 🟡 Warning: Code review bottleneck |

### Auto-Alert Query (Runs daily)

```sql
-- Check metrics against thresholds
SELECT 
  metric_name,
  current_value,
  threshold,
  is_alert,
  CASE 
    WHEN is_alert THEN 'ALERT'
    WHEN current_value > threshold * 0.8 THEN 'WARNING'
    ELSE 'OK'
  END AS status
FROM kpi_health_check
WHERE week = DATE_TRUNC('week', NOW())
ORDER BY status DESC;
```

---

## Part 6: Monthly & Quarterly Review

### Monthly Retrospective (End of Month)

**Question:** Why did metrics trend this way?

```markdown
## April 2026 KPI Review

### Metric Highlights
- ✅ Lead time improved 8% (3.2d → 2.1d) — better code review workflow
- 🟡 Change failure rate up 4% (8% → 12%) — one DB incident after deploy
- ✅ MTTR down 10% (20m → 18m) — faster incident response

### Root Causes
1. Lead time improvement:
   - Hired 2 more reviewers
   - Async reviews (non-blocking) for non-critical PRs
   
2. Failure rate increase:
   - One bad deploy: Performance regression not caught by tests
   - Action: Add performance budgets + CI gate (T2.3)

### Action Items
- Increase test coverage for money-moving (done: T2.2)
- Implement performance budgets (T2.3 this week)
- Add ADRs for architecture decisions (T2.4 this week)

### Trend Forecast
- Expected lead time: 1.8–2.2 days (stable)
- Expected failure rate: <10% (improving with tests)
- MTTR: Sub-15 min for P1 (improving)
```

### Quarterly Goals (Set at Start of Quarter)

```
Q2 2026 Delivery Goals:

🎯 Deployment Frequency: 2.0+ per week (was 1.5 in Q1)
🎯 Lead Time (median): <2.0 days (was 2.8 in Q1)
🎯 Change Failure Rate: <10% (was 12% in Q1)
🎯 MTTR (P1): <20 minutes (was 25 in Q1)
🎯 Code Review Velocity: <24h median (was 36h in Q1)

Status tracking: Weekly dashboard update + monthly retrospective
```

---

## Part 7: Implementation Checklist (May 1–15)

**Week 1 (May 1–5): Setup**
- [ ] Create GitHub Actions workflow (collect-kpis.yml)
- [ ] Create queries for each metric (4 DORA + 3 supporting)
- [ ] Set up Notion dashboard template
- [ ] Manual dry-run (collect metrics for this week)
- Effort: 4 hours

**Week 2 (May 8–12): Publication**
- [ ] Connect to GitHub API (deployments, PRs)
- [ ] Connect to Sentry API (incidents, MTTR)
- [ ] Publish to Notion dashboard (auto-update)
- [ ] Post weekly summary to Slack #metrics
- Effort: 4 hours

**Week 3 (May 15–22): Alert Setup**
- [ ] Create alert thresholds in code
- [ ] Send Slack notifications when thresholds crossed
- [ ] Team training: how to read dashboard + interpret metrics
- [ ] Document process in runbook
- Effort: 3 hours

**Total Effort:** 11 hours (Platform Lead + DevOps)

---

## Part 8: Exit Criteria (T6.4)

- [x] DORA metrics defined (Deployment Frequency, Lead Time, Change Failure, MTTR)
- [x] Supporting metrics defined (incidents, rollback rate, code review)
- [x] Dashboard UI designed (weekly view + 12-week trends)
- [x] Queries written for each metric
- [x] Collection & automation scripted (GitHub Actions)
- [x] Alert thresholds defined
- [ ] Workflow deployed to GitHub (May 1)
- [ ] First week of data collected (May 6)
- [ ] Team training completed (May 15)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Platform Lead | T6.4 DORA metrics dashboard; 4 core metrics + 3 supporting; queries, workflows, alerts |

---

**Status:** ✅ T6.4 DELIVERY KPI FRAMEWORK READY  
**Next Action:** Deploy GitHub Actions workflow (May 1); collect first week's data; verify on Notion dashboard

**References:**
- [NIST DORA Metrics](https://dora.dev/)
- [Accelerate: Building High-Performing Technology Organizations](https://www.goodreads.com/book/show/35747076-accelerate) by Nicole Forsgren
- [GitHub API: Deployments](https://docs.github.com/en/rest/deployments)
- [Sentry API: Events](https://docs.sentry.io/api/events/)
