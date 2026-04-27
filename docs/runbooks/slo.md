# SLO Runbook

This runbook defines the Service Level Objectives for Factory apps and the alert thresholds used to enforce them.

## SLO targets

| Metric | Target | Measurement window |
|---|---|---|
| Availability | ≥ 99.9% | Rolling 30 days |
| p99 latency | < 200 ms | Rolling 24 hours |
| Error budget | < 0.1% 5xx | Rolling 30 days |
| Successful deploys | 100% (no broken builds) | Per release |

## Error budget

With a 99.9% availability target:
- Monthly error budget: **43.8 minutes** of downtime
- Budget burn rate alert at: **5× burn rate** (depletes budget in 6 days)

## Sentry alerts

Sentry is the primary error monitoring system. DSN is set via `SENTRY_DSN` Worker secret.

### Recommended alert rules

| Alert | Condition | Priority |
|---|---|---|
| Error spike | > 10 errors/minute (new issues) | Critical |
| High error rate | 5xx rate > 1% over 5 minutes | High |
| P99 degradation | Not available in Sentry — use Cloudflare Analytics |
| New issue (first seen) | Any new `InternalError` | Medium |

Configure in **Sentry → Alerts → Create Alert Rule → Issue Alerts**.

### Example Sentry alert (via Sentry API)

```bash
# Create an alert for any new error in the production environment
curl -X POST https://sentry.io/api/0/projects/{org}/{project}/rules/ \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New error in production",
    "conditions": [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}],
    "filters": [{"id": "sentry.rules.filters.tagged_event.TaggedEventFilter","key":"environment","value":"production"}],
    "actions": [{"id": "sentry.mail.actions.NotifyEmailAction","targetType": "IssueOwners"}],
    "frequency": 30
  }'
```

## Cloudflare Analytics alerts

Use Cloudflare Workers Analytics for latency and request rate monitoring.

In **Cloudflare Dashboard → Workers → {app} → Metrics**:

- Set alert: **Error rate > 1%** over a 5-minute window → notify via email
- Set alert: **P99 CPU time > 50ms** (as a proxy for latency) → notify via email

These can also be configured via Cloudflare Notifications:

```bash
# Via Cloudflare API - create a Workers alert
curl -X POST https://api.cloudflare.com/client/v4/accounts/{account_id}/alerting/v3/policies \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "{app} high error rate",
    "alert_type": "workers_script_alert",
    "enabled": true,
    "mechanisms": {"email": [{"id": "admin@thefactory.dev"}]},
    "filters": {
      "services": ["{app}"],
      "limit": "1"
    }
  }'
```

## PostHog funnel monitoring

PostHog tracks business-level events via `@adrper79-dot/analytics`.

Key funnels to monitor:
- **Signup funnel**: `user_signup` → `email_verified` → `first_action`
- **Conversion funnel**: `page_view` → `cta_click` → `checkout_started` → `subscription_created`

Set PostHog **Insights → Funnel** alerts for:
- Conversion drop > 20% week-over-week
- `subscription_created` events drop > 10% day-over-day

## Incident response

1. **P1 (site down)**: Immediate rollback via `wrangler rollback --env production`, notify in #incidents.
2. **P2 (elevated errors)**: Investigate Sentry, check recent deploy, consider rollback.
3. **P3 (latency degradation)**: Check Neon query performance, review Hyperdrive health.
4. **P4 (business metric drop)**: Review PostHog funnels, check for A/B test side effects.

## On-call rotation

Factory apps are currently operated by a single team. Establish PagerDuty rotation when:
- Monthly active users > 1,000 per app
- Revenue per app > $5,000 MRR
