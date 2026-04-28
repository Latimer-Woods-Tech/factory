# SLO Framework: Making Reliability Measurable

**Document Version:** 1.0  
**Last Updated:** April 28, 2026  
**Audience:** Engineering, product, operations, and design teams

---

## Overview

Service-Level Objectives (SLOs) translate business reliability needs into measurable targets. This framework establishes how Factory defines, measures, and enforces SLOs across all services.

---

## Core Concepts

### Service-Level Indicator (SLI)
A **measurement** of service performance. Specific, defined metric that can be queried from monitoring systems.

Examples:
- Availability: `(total_requests - 5xx_errors) / total_requests`
- Latency: `p99_response_time_milliseconds`
- Error Rate: `(4xx_errors + 5xx_errors) / total_requests`
- Durability: `(writes_acknowledged - writes_lost) / writes_acknowledged`

### Service-Level Objective (SLO)
A **target** for an SLI. The percentage or threshold the service aims to achieve over a measurement window.

Examples:
- Availability SLO: 99.9% uptime over 30 days
- Latency SLO: p99 latency < 500ms measured over 24 hours
- Error rate SLO: < 0.5% over 30 days

### Error Budget
The **allowable failure window** to still achieve the SLO. How much downtime or errors can we tolerate?

#### Error Budget Calculation Examples

##### Availability-based error budget (most common)

| SLO Target | Measurement Window | Annual Downtime | Monthly Downtime | Hourly Downtime |
|------------|-------------------|-----------------|------------------|-----------------|
| 99% | 30 days | 3.65 days | 7.2 hours | 14.4 minutes |
| 99.5% | 30 days | 1.83 days | 3.6 hours | 7.2 minutes |
| 99.9% | 30 days | 8.77 hours | 43.2 minutes | 1.44 minutes |
| 99.95% | 30 days | 4.38 hours | 21.6 minutes | 0.72 minutes |
| 99.99% | 30 days | 52.6 minutes | 4.32 minutes | 0.086 minutes |

**Formula:**
```
Error Budget = (1 - SLO Target) × Measurement Window
```

Example: If SLO = 99.9% over 30 days:
```
Error Budget = (1 - 0.999) × 30 days × 24 hours × 60 minutes
Error Budget = 0.001 × 43200 minutes = 43.2 minutes
```

##### Latency-based error budget

Example SLO: p99 latency < 500ms over 24 hours

Possible approaches:
- **High Water Mark**: If p99 latency exceeds 500ms at any point, SLO is breached (conservative, strict)
- **Error Budget**: If >5% of requests exceed 500ms over 24 hours, budget is consumed (percentage-based allowance)

Factory uses **percentage-based error budget** for latency to allow variance while tracking trend.

##### Error rate-based error budget

Example SLO: < 0.5% error rate over 30 days

If daily error rates are 0.3%, 0.5%, 0.4%, 0.6%, we're tracking **average** error rate across the window.

Calculate monthly error budget consumed:
```
Monthly errors allowed = 0.5% × 2.592M requests
Actual errors observed = observed_5xx_count
Budget consumed % = (Actual errors / Allowed errors) × 100
```

---

## SLO Tiers

Factory services are classified by criticality. Each tier has different SLO targets and escalation rules.

### Tier 1: Critical (Business-blocking)
Services that directly impact revenue or legal/compliance.

**Examples:** Auth, payment processing, payout execution, data retention

**Typical SLOs:**
- Availability: 99.95% (21.6 minutes downtime / 30 days)
- p99 latency: 500ms
- Error rate: < 0.5%
- Durability: 100% (no data loss permissible)

**Budget Consumption Trigger:**
- >80% consumed: Code freeze on non-critical features; begin reliability sprint
- 100% consumed: Postmortem required; critical bugs take top priority

**On-call:** Yes, 24/7 rotation required

---

### Tier 2: Important (Customer-facing, high-value)
Services that materially degrade user experience but aren't blocking revenue.

**Examples:** Video streaming, user discovery, notifications, recommendations

**Typical SLOs:**
- Availability: 99.9% (43.2 minutes / 30 days)
- p95 latency: 2 seconds
- Error rate: < 1%

**Budget Consumption Trigger:**
- >80% consumed: Prioritize reliability bug fixes; defer low-priority features
- 100% consumed: Postmortem; plan follow-up reliability sprint

**On-call:** Yes, business-hours rotation (8am–6pm)

---

### Tier 3: Best-Effort (Non-blocking, internal)
Services that are "nice to have" but don't affect core experience.

**Examples:** Analytics dashboards, recommendations ML refresh, admin UI secondary features

**Typical SLOs:**
- Availability: 99% (7.2 hours / 30 days)
- p90 latency: 5 seconds
- Error rate: < 5%

**Budget Consumption Trigger:**
- >80% consumed: Noted in weekly ops review; fix at next convenient pull
- 100% consumed: Log incident; plan fix; no escalation required

**On-call:** No (async bug response)

---

## Measuring SLIs

### Where to measure (measurement layers)

| Layer | Pros | Cons | Use Case |
|-------|------|------|----------|
| **Request edge (Cloudflare)** | See 100% of traffic; fast; real user experience | Cloudflare Workers sometimes drop/retry requests | Primary metric for availability |
| **Application layer (Sentry)** | Catch app-level errors; full stack traces | May miss edge/platform errors | Error rates, specific failure types |
| **Database query logs (Neon)** | Slow query insights; lock contention | More overhead to query; high volume | Latency debugging, query performance |
| **Synthetic checks (Uptime Robot, custom)** | Can test happy path consistently | Misses real user patterns; false positives | Supplementary; P1 alerting only |

**Factory standard:** Use Cloudflare Workers Analytics for primary availability and latency, Sentry for error categorization, Neon logs for debugging.

### Tooling

| Metric | Tool | Query |
|--------|------|-------|
| Availability (5xx rate) | Cloudflare Analytics / Workers Tail | `(total_requests - error_count) / total_requests` |
| Latency (p99) | Cloudflare Workers Analytics | Cloudflare Dashboard → Metrics → P99 CPU Time |
| Error rate (4xx vs 5xx) | Sentry Issues + Cloudflare Analytics | Sentry: `environment:production AND level:error` |
| Overall health | PostHog trends | PostHog: `factory_events` table grouped by event type |

### Dashboards

Each SLO tier should have a real-time dashboard showing:
1. Current month's error budget consumption (%)
2. Trend over past 4 quarters
3. Incidents vs SLO dips (correlation view)
4. Alert history (threshold crossings)

See [slo-dashboard-template.yaml](../dashboards/slo-dashboard-template.yaml) for implementation.

---

## Alert Rules & Escalation

### Error Budget Burn Rate

Track how fast the monthly error budget is being consumed. High burn rate = imminent SLO breach.

**Burn Rate Calculation:**

```
Burn Rate = Error Budget Consumed in Last 1h / (Monthly Budget × 30 days / 30 hours)
           = Errors in 1h / (Monthly Budget / 720 hours)
```

Example: Tier 1 service with 99.95% SLO (10.8 min/month budget)

```
Monthly budget = 10.8 minutes
Hourly equivalent = 10.8 / 720 = 0.015 minutes = 0.9 seconds downtime
If we see 0.9 seconds of errors in the past hour:
Burn Rate = 0.9 / 0.9 = 1× (on track to breach in 30 days)
If we see 4.5 seconds of errors in the past hour:
Burn Rate = 4.5 / 0.9 = 5× (will breach budget in 6 days at this rate)
```

### Threshold-based Alerting

| Burn Rate | Action | Severity | Window |
|-----------|--------|----------|--------|
| 1× | Informational; track trend | Info | 1 hour |
| 2× | Warning; plan investigation | Warning | 30 minutes |
| 5× | Page engineer; begin incident response | High | 5 minutes |
| 10× | Critical; escalate; page on-call | Critical | 1 minute |

**Tier mapping:**
- **Tier 1:** Page at 5× burn rate (will breach in 6 days) or 10× (imminent)
- **Tier 2:** Page at 10× burn rate; warn at 5×
- **Tier 3:** Log warning at 5×; no page

### SLO Breach Response

When an SLO is breached (error budget fully consumed):

1. **Trigger:** Automated alert fires (e.g., Sentry + Cloudflare detect >99.95% error rate for Tier 1)
2. **Page on-call:** High-priority incident
3. **Postmortem required:** Scheduled within 48 hours
4. **Root cause fix:** Must be prioritized in next sprint
5. **Public status:** Update status page (if Tier 1; optional for Tier 2)

---

## Quarterly SLO Review Cadence

### Q Review Process

**Schedule:** Last week of each quarter (e.g., March 29–31 for Q1)

**Participants:**
- Engineering lead
- Product lead
- Ops lead
- Relevant service owners

**Agenda:**

1. **Consume Analysis:** How much error budget was burned each month? Any patterns?
   - Plot burn rate over the quarter
   - Identify incidents vs. slow degradation
   - Note if any month showed 100% budget consumed

2. **SLI Accuracy:** Are we measuring the right thing?
   - Is the SLI still capturing what customers care about?
   - Are there blind spots in our metrics?
   - Should we add new SLIs (e.g., payment success rate)?

3. **Target Adjustment:** Should we change the SLO target?
   - If budget was never threatened: Can we lower the target (invest in more risky features)?
   - If budget was frequently breached: Should we increase target (invest in reliability)?
   - Business changes: New markets, new features, new customers?

4. **Outcome:** Publish updated SLOs for next quarter; communicate changes to team

### Example Q Review for Tier 1 Auth Service

**Q1 2026 Analysis:**
- Jan: 22% budget consumed (holiday traffic spike)
- Feb: 15% budget consumed (normal ops)
- Mar: 8% budget consumed (calm period)
- **Total:** 45% consumed over quarter (within healthy range)

**Decision:** No SLO change. Continue 99.95% target.

**Next quarter focus:** Invest in latency improvements (p99 often at 450ms, leaving little headroom to 500ms SLO)

---

## Integration with Error Budget Policy

See [error-budget-policy.md](error-budget-policy.md) for the operational discipline around budget consumption.

Key principle: If error budget is consumed fast, _entire team prioritizes reliability_. Feature development pauses for non-critical work.

---

## FAQ

**Q: What if we hit the SLO exactly (100% consumed, not breached)?**
A: The SLO was achieved. No action required, though we may review the burn rate trend at next Q review.

**Q: Can we increase SLOs mid-quarter if budget is running low?**
A: Only in exceptional circumstances (e.g., infrastructure incident outside our control). Normal drift is managed at Q reviews only. Changing SLOs mid-period masks reliability issues.

**Q: What if an SLI is measuring wrong (e.g., synthetic traffic counted as real users)?**
A: Log it immediately. Recalculate SLO status for the affected period. Adjust tooling; document the fix. Then resume normal measurement.

**Q: How do we prioritize latency vs. availability?**
A: Both are required for each tier. Availability is primary (users can retry if slow, but can't use a down service). Latency is secondary but equally important. If both are breached, availability gets priority in postmortem.

**Q: What constitutes an "acceptable" reason to consume budget?**
A: Unplanned events (bugs, data corruption, provider outages). Planned maintenance doesn't count—schedule during budget cushion or extend SLO window to account for it.

---

## Next Steps

1. Apply this framework to videoking-specific tiers: [slo-targets.md](../videoking/slo-targets.md)
2. Set error budget policy: [error-budget-policy.md](error-budget-policy.md)
3. Configure dashboards: [slo-dashboard-template.yaml](../dashboards/slo-dashboard-template.yaml)
4. Link from monitoring package: Review `@adrper79-dot/monitoring` guidance
