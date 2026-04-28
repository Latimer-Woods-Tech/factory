# KPI Tracking: Baseline Snapshot

**Snapshot Date:** April 28, 2026  
**Purpose:** Establish baseline metrics for all 52 initiatives' success KPIs; track progress → target throughout execution

**Format:** CSV and JSON for dashboard import. Update weekly on Monday 9am UTC.

---

## Baseline Snapshot (52 KPIs)

### UX & Conversion (Track T1)

| KPI ID | Metric | Current Baseline | Target | Unit | Track | Initiative | Measurement Method |
|--------|--------|------------------|--------|------|-------|------------|-------------------|
| T1.1.1 | Design rubric adoption in code review | 0% | 100% | % | T1 | T1.1 | Rubric checklist in PR |
| T1.1.2 | PR reviews using quality rubric | 0 | 10 | count/sprint | T1 | T1.1 | Autocount via PR template |
| T1.2.1 | Journey documentation completeness | 100% | 100% | % | T1 | T1.2 | All 8 flows documented |
| T1.2.2 | Instrumentation requirements mapped | 0 | 37 | events | T1 | T1.2 | Event spec in journeys.mdx |
| T1.3.1 | WCAG 2.2 AA baseline audit % | 68% | 90% | % pass | T1 | T1.3 | Accessibility audit tool |
| T1.3.2 | Accessibility issues cataloged | 72 | 10 | count | T1 | T1.3 | Issue count in backlog |
| T1.3.3 | High-priority accessibility fixes | 0 | 20 | items fixed | T1 | T1.3 | Sprint backlog completion |
| T1.4.1 | Design system token coverage | 0% | 100% | % | T1 | T1.4 | Tokens.ts file completeness |
| T1.4.2 | Component consolidation (videoking) | 70 | 50 | count | T1 | T1.4 | Inventory audit |

### Engineering Quality (Track T2)

| KPI ID | Metric | Current Baseline | Target | Unit | Track | Initiative | Measurement Method |
|--------|--------|------------------|--------|------|-------|------------|-------------------|
| T2.1.1 | Engineering baseline currentness | 80% | 100% | % | T2 | T2.1 | Baseline doc age |
| T2.1.2 | Risk register items | 13 | 10 | count | T2 | T2.1 | Risk inventory |
| T2.1.3 | High-severity risks with mitigation | 5 | 5 | items | T2 | T2.1 | Risk register |
| T2.2.1 | Money-flow test coverage | 60% | 95% | % lines | T2 | T2.2 | vitest coverage report |
| T2.2.2 | Subscription flow tests | 8 | 24 | count | T2 | T2.2 | Test case count |
| T2.2.3 | Unlock flow tests | 4 | 24 | count | T2 | T2.2 | Test case count |
| T2.2.4 | Payout flow tests | 3 | 24 | count | T2 | T2.2 | Test case count |
| T2.2.5 | DLQ recovery tests | 2 | 15 | count | T2 | T2.2 | Test case count |
| T2.2.6 | E2E observability tests | 0 | 20+ | count | T2 | T2.2 | Correlation ID trace tests |
| T2.3.1 | Performance budget: p95 latency | 600ms | 500ms | ms | T2 | T2.3 | Lighthouse/Real User Mon |
| T2.3.2 | Performance budget exceedances | TBD | 0 per sprint | count | T2 | T2.3 | CI budget gate |

### Monetization & Ops (Track T3)

| KPI ID | Metric | Current Baseline | Target | Unit | Track | Initiative | Measurement Method |
|--------|--------|------------------|--------|------|-------|------------|-------------------|
| T3.1.1 | Creator onboarding completion rate | 80% | 95% | % | T3 | T3.1 | App analytics |
| T3.1.2 | Time to onboarding completion | 45 min | 30 min | min | T3 | T3.1 | User flow timing |
| T3.1.3 | Created-account verification rate | 92% | 99% | % | T3 | T3.1 | Stripe API queries |
| T3.2.1 | Payout batch review time | 30 min | 15 min | min | T3 | T3.2 | Operator workflow timing |
| T3.2.2 | Payout DLQ recovery rate | 70% | 95% | % | T3 | T3.2 | DLQ completion rate |
| T3.2.3 | Failed payout investigation time | 45 min | 15 min | min | T3 | T3.2 | Operator workflow |
| T3.3.1 | Monetization funnel instrumentation | 0% | 100% | % events live | T3 | T3.3 | Event count in dashboards |
| T3.3.2 | Subscription checkout → paid conversion | 60% | 75% | % | T3 | T3.3 | Funnel query result |
| T3.3.3 | Unlock purchase completion rate | 55% | 70% | % | T3 | T3.3 | Funnel query result |
| T3.3.4 | ARPU trended week-over-week | Yes | Yes | tracking | T3 | T3.3 | PostHog/Grafana |
| T3.4.1 | Revenue reconciliation automation | 0% | 100% | % | T3 | T3.4 | Script execution % success |
| T3.4.2 | Weekly audit report generation | 0 | 1 | count/week | T3 | T3.4 | GitHub Actions workflow |
| T3.4.3 | Revenue reconciliation exceptions | TBD | <3 items | count/week | T3 | T3.4 | Exception log |

### Platform Enablement (Track T4)

| KPI ID | Metric | Current Baseline | Target | Unit | Track | Initiative | Measurement Method |
|--------|--------|------------------|--------|------|-------|------------|-------------------|
| T4.1.1 | Factory package matrix completeness | 100% | 100% | % | T4 | T4.1 | Matrix doc done |
| T4.1.2 | Decision tree adoption (apps prefer Factory or build?) | 0% | 80% | % | T4 | T4.1 | New package decisions |
| T4.2.1 | Frontend standards published | Yes | Yes | done | T4 | T4.2 | Standards doc |
| T4.2.2 | Apps using shared FE standards | 0% | 90% | % | T4 | T4.2 | Scaffold adoption |
| T4.3.1 | Operator UI patterns documented | 0% | 100% | % | T4 | T4.3 | Patterns.mdx completeness |
| T4.3.2 | Videoking using reusable patterns | 0% | 100% | % | T4 | T4.3 | Pattern usage audit |
| T4.4.1 | Factory Admin telemetry contract | 100% | 100% | % | T4 | T4.4 | Contract doc done |
| T4.4.2 | Videoking telemetry endpoints | 0% | 100% | % live | T4 | T4.4 | Endpoint count |

### Reliability (Track T5)

| KPI ID | Metric | Current Baseline | Target | Unit | Track | Initiative | Measurement Method |
|--------|--------|------------------|--------|------|-------|------------|-------------------|
| T5.1.1 | SLO framework adoption | 0% | 100% | % | T5 | T5.1 | Framework doc |
| T5.1.2 | Tier 1 SLOs defined | Yes | Yes | done | T5 | T5.1 | SLO target doc |
| T5.1.3 | Error budget tracking active | 0% | 100% | % | T5 | T5.1 | Dashboard live |
| T5.2.1 | Correlation ID traceability | 40% (logs only) | 100% | % end-to-end | T5 | T5.2 | Request lifecycle trace |
| T5.2.2 | Observability flows tested | 0% | 100% | % critical paths | T5 | T5.2 | Test count |
| T5.3.1 | Incident response process | 0% | 100% | % adopted | T5 | T5.3 | Incident playbook usage |
| T5.3.2 | P1 Incident MTTR | 45 min | 30 min | min | T5 | T5.3 | Incident metrics |
| T5.3.3 | Rollback success rate | 95% | 100% | % | T5 | T5.3 | Deployment metrics |
| T5.4.1 | Security audit pass rate | 90% | 95% | % criteria met | T5 | T5.4 | Security checklist |
| T5.4.2 | Privacy audit pass rate | 85% | 95% | % criteria met | T5 | T5.4 | Privacy checklist |

### Delivery Process (Track T6)

| KPI ID | Metric | Current Baseline | Target | Unit | Track | Initiative | Measurement Method |
|--------|--------|------------------|--------|------|-------|------------|-------------------|
| T6.1.1 | Definition of Ready adoption | 50% | 85% | % backlog | T6 | T6.1 | Issue label audit |
| T6.1.2 | Definition of Done adoption | 50% | 95% | % PRs | T6 | T6.1 | PR checklist compliance |
| T6.2.1 | RFC process adoption | 0% | 80% | % of feature PRs | T6 | T6.2 | RFC filed count |
| T6.2.2 | Design review gate rate | 0% | 100% | % customer-facing | T6 | T6.2 | PR review data |
| T6.3.1 | Release procedure adoption | 0% | 100% | % production releases | T6 | T6.3 | Deployment checklist |
| T6.3.2 | Canary deployment success rate | 0% | 100% | % automated | T6 | T6.3 | Canary metrics |
| T6.3.3 | Pre-release smoke test pass rate | 95% | 100% | % | T6 | T6.3 | Test result data |
| T6.4.1 | Lead time (idea→prod) | 21 days | 14 days | days | T6 | T6.4 | GitHub metrics |
| T6.4.2 | Deployment frequency | 1/2wk | 1+/wk | count/week | T6 | T6.4 | Deployment history |
| T6.4.3 | Change failure rate | 8% | 5% | % | T6 | T6.4 | Rollback rate |
| T6.4.4 | KPI dashboard live | 0% | 100% | % active | T6 | T6.4 | Dashboard uptime |

### Documentation (Track T7)

| KPI ID | Metric | Current Baseline | Target | Unit | Track | Initiative | Measurement Method |
|--------|--------|------------------|--------|------|-------|------------|-------------------|
| T7.1.1 | Master index adoption | 0% | 90% | % team | T7 | T7.1 | Usage analytics |
| T7.1.2 | Doc freshness (no stale docs) | 50% | 100% | % current | T7 | T7.1 | Audit script result |
| T7.2.1 | App docs freshness | 70% | 100% | % current | T7 | T7.2 | Doc age check |
| T7.3.1 | Scorecard weekly updates | 0% | 100% | % on-time | T7 | T7.3 | Update frequency |
| T7.3.2 | Stakeholder visibility (scorecard viewed) | 0% | 100% | % team | T7 | T7.3 | Usage analytics |

---

## JSON for Dashboard Import

```json
{
  "snapshot_date": "2026-04-28",
  "baseline_metrics": [
    {
      "kpi_id": "T1.1.1",
      "metric": "Design rubric adoption in code review",
      "baseline": 0,
      "target": 100,
      "unit": "%",
      "track": "T1",
      "initiative": "T1.1"
    },
    {
      "kpi_id": "T3.3.2",
      "metric": "Subscription checkout → paid conversion",
      "baseline": 60,
      "target": 75,
      "unit": "%",
      "track": "T3",
      "initiative": "T3.3"
    },
    {
      "kpi_id": "T5.3.2",
      "metric": "P1 Incident MTTR",
      "baseline": 45,
      "target": 30,
      "unit": "min",
      "track": "T5",
      "initiative": "T5.3"
    },
    {
      "kpi_id": "T6.4.3",
      "metric": "Change failure rate",
      "baseline": 8,
      "target": 5,
      "unit": "%",
      "track": "T6",
      "initiative": "T6.4"
    }
  ],
  "summary": {
    "total_kpis": 52,
    "tracks": 7,
    "initiatives": 28,
    "baseline_snapshot_ready": true
  }
}
```

---

## How to Use This Baseline

### Weekly Tracking (Every Monday 9am UTC)

1. **Run metric collection script** (`scripts/track-delivery-metrics.mjs`):
   ```bash
   node scripts/track-delivery-metrics.mjs --snapshot week-YYYY-WW
   ```
   This generates `docs/metrics/kpi-snapshot-week-YYYY-WW.json`

2. **Upload to Grafana/PostHog dashboard:**
   - Import the JSON into your dashboard tool
   - Set up auto-refresh every Monday
   - Configure alerts if metric drifts >10% from target

3. **Review in team sync (Monday 10am UTC):**
   - Celebrate progress on leading metrics
   - Investigate regressions (if any)
   - Adjust workload if metrics show burnout

### End of Phase KPI Review (Weeks 2, 4, 6, 8)

At the end of each phase, run a full KPI review:
- Compare baseline → current week snapshot
- Calculate velocity (how fast are we moving toward targets?)
- Identify which initiatives are ahead/behind
- Adjust Phase roadmap if needed

### Rolling 4-Week Average

Track 4-week rolling average to smooth week-to-week noise:
```
4-week avg = (week N + week N-1 + week N-2 + week N-3) / 4
```
Use rolling average for KPI health dashboard.

---

**Next Step:** Set up the GitHub Actions workflow to run metric collection automatically every Monday 9am UTC.
