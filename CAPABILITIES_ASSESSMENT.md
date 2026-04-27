# Factory Core — Capabilities Gap Analysis & Enhancement Opportunities

**Date:** April 27, 2026  
**Status:** All 19 packages v0.2.0 published; 6 apps scaffolded  
**Author:** Capability Assessment

---

## Executive Summary

The Factory Core platform is **feature-complete at infrastructure layer** (errors → admin). The next wave of value comes from **operational observability, deployment safety, and developer experience**.

### By the Numbers

| Layer | Status | Gap |
|---|---|---|
| **Infrastructure packages** | 19/19 ✅ | None |
| **App repos** | 6/6 ✅ | None |
| **Observability wiring** | 2/3 ⚠️ | PostHog integration missing from apps |
| **Deployment automation** | Partial | Blue/green, SLO tracking, incident response |
| **Developer tooling** | Basic | Local dev environment, testing utilities |
| **Documentation** | Config only | Mintlify not deployed; no runbooks |

---

## Critical Missing Pieces (Must Have)

### 1. **PostHog Integration in Apps** ⚠️ HIGH PRIORITY
**What exists:**
- `@adrper79-dot/analytics` exports `trackEvent(db, opts)` to factory_events table
- Monitoring package exists with Sentry

**What's missing:**
- PostHog SDK not initialized in any of the 6 Worker apps
- No event capture middleware in Hono routers
- No funnels defined (signup → payment → recurring revenue)

**Impact:** Cannot see user behavior, feature adoption, or conversion metrics. CRM package is blind to why leads convert or churn.

**Quick fix:** 
```typescript
// In each app's worker setup:
import { createPostHogClient } from '@adrper79-dot/analytics'; // extend this
posthog.init(env.POSTHOG_API_KEY);
middleware for auto-tracking
```

---

### 2. **Renovate Automation on App Repos** ⚠️ HIGH PRIORITY
**What exists:**
- All packages can bump independently (e.g., neon v0.2.1)

**What's missing:**
- Renovate not configured on wordis-bond, prime-self, cypher-healing, etc.
- When Factory Core packages bump, apps don't auto-get update PRs
- Manual `npm update @adrper79-dot/*` required per app

**Impact:** Apps drift from latest security/feature updates. Cannot control version rollout across platform.

**Quick fix:** Add `renovate.json` to each app repo pointing to main Factory renovate config.

---

### 3. **SLO Dashboards & Incident Runbooks** ⚠️ HIGH PRIORITY
**What exists:**
- Sentry captures errors
- factory_events table records operations

**What's missing:**
- No defined SLOs (Auth latency? CRM availability? Email delivery time?)
- No incident response playbooks (who do you page? How do you roll back?)
- No dashboard showing real-time SLO health

**Impact:** Cannot detect degradation before customers do. No playbook means firefighting instead of coordinated response.

**Quick fix:**
```yaml
# docs/slo.md
Auth API:
  - Availability: 99.5%
  - Latency p99: < 200ms
  - Alert when: 2 errors per min OR latency p95 > 500ms
  - On-call runbook: docs/runbooks/auth-degradation.md
```

---

## Important Gaps (Should Have)

### 4. **Blue/Green Deployments via Cloudflare Environments**
**What exists:** Every app can `wrangler deploy` to production directly

**What's missing:**
- No staging environment (PR deploys to temporary URL)
- No production approval gate
- No instant rollback (need to redeploy old code)

**Impact:** High-risk deployments; mistakes hit all users simultaneously.

### 5. **Load Testing Framework**
**What exists:** Individual packages have unit tests

**What's missing:**
- No end-to-end load test (100 concurrent users hitting Auth?)
- No capacity planning data
- No performance baselines per Worker

**Impact:** Scale unknown; cannot predict breaking points.

### 6. **Mintlify Documentation Deployment**
**What exists:** Config in place; docs README exists

**What's missing:**
- Docs site not live
- No API reference for each package
- Developers must read TypeScript files instead of docs

**Impact:** Friction on onboarding; hard to discover package capabilities.

---

## Nice-to-Have Enhancements (Could Have)

### 7. **Local Development Environment** (`@adrper79-dot/devtools` package)
- Docker Compose for Postgres + mocked Hyperdrive
- Seed scripts for test data (1,000 leads, conversion history)
- VSCode launch config for debugging Workers locally
- Mock `env.DB` binding for offline development

### 8. **Secrets Rotation Manager** (extend `@adrper79-dot/deploy`)
- Automated Stripe API key cycling (30-day rotation)
- Neon password rotation with zero downtime
- Audit trail logged to factory_events

### 9. **Security Automation Package** (`@adrper79-dot/security`)
- Pre-publish OWASP Top 10 scan (CI gate)
- Secret scanning (GitGuardian hook)
- GDPR compliance audit report
- Dependency CVE check

### 10. **Advanced CRM Analytics** (extend `@adrper79-dot/crm`)
- LTV calculation per channel
- Cohort retention curves
- Churn risk prediction model
- Revenue forecasting dashboard

---

## Recommended Phased Rollout

### **Phase 0: Observability (This Week)**
1. ✅ Wire PostHog SDK into each app router
2. ✅ Define SLO metrics in `docs/slo.md`
3. ✅ Create incident escalation runbook
4. **Effort:** 8–16 hours  
5. **Value:** Operational visibility; can detect issues in real time

### **Phase 1: Deployment Safety (Next Week)**
1. ✅ Add staging environment to each app (CF Pages preview)
2. ✅ Set up approval gates in GitHub (main → production requires review)
3. ✅ Implement `wrangler rollback` automation
4. **Effort:** 12–20 hours  
5. **Value:** Risk mitigation; fast incident recovery

### **Phase 2: Developer Experience (Week 3)**
1. ✅ Deploy Mintlify docs site
2. ✅ Add local dev Docker Compose
3. ✅ Create `@adrper79-dot/devtools` package
4. **Effort:** 16–24 hours  
5. **Value:** Faster onboarding; offline development

### **Phase 3: Intelligence (Week 4)**
1. ✅ Build Factory Admin conversion dashboard (PostHog data)
2. ✅ Add LTV calculation to CRM package
3. ✅ Create performance baseline dashboards
4. **Effort:** 20–32 hours  
5. **Value:** Data-driven decisions; capacity planning

---

## Implementation Checklist for Phase 0 (Start Here)

### Task 1: PostHog Integration
- [ ] Create PostHog client factory in `@adrper79-dot/analytics`
- [ ] Export `createPostHogMiddleware()` for Hono apps
- [ ] Auto-track: route hit, auth success/fail, error rate
- [ ] Add to each app's setup script (`setup-all-apps.mjs`)
- [ ] Wire PostHog API key into GitHub secrets per app

### Task 2: SLO Definition & Dashboard
- [ ] Write `docs/slo.md` with Auth, CRM, Email SLOs
- [ ] Set up Sentry + PostHog dashboard integration
- [ ] Create `docs/runbooks/` folder with incident response guides
- [ ] Link SLOs to PagerDuty (if using)

### Task 3: Renovate Configuration
- [ ] Copy factory renovate config to each app repo
- [ ] Test: merge a Factory package bump to see app PRs auto-open
- [ ] Document in `docs/deployment.md`: "How to update packages across all apps"

### Task 4: Verify & Document
- [ ] Smoke test: generate a fake event, confirm in PostHog
- [ ] Confirm SLO dashboard shows real-time data
- [ ] Write new runbooks into `docs/operations.md`

---

## Which Should We Build First?

**If you care about:** → **Do this first:**
- **"I see errors but don't know why"** → PostHog + SLO dashboard
- **"I'm afraid to deploy"** → Blue/green + approval gates
- **"My team hates setup"** → DevTools + Mintlify
- **"Will this scale?"** → Load testing + capacity baseline
- **"Why are users churning?"** → Advanced CRM + LTV calc

---

## Open Questions for Prioritization

1. **Observability target?** (Splunk, Datadog, PostHog-only, or self-hosted?)
2. **Incident response?** (PagerDuty, Slack-native, or manual?)
3. **On-call rotation?** (Who is responsible if auth goes down?)
4. **Deployment frequency?** (Daily, weekly, or ad-hoc?)
5. **Scaling target?** (1,000 users, 100k users, or unknown?)

Answering these will refine the recommended order.

---

## Summary of Gaps

| Gap | Severity | Fix Time | Current Risk |
|---|---|---|---|
| PostHog wiring | HIGH | 4–6h | Blind to user behavior |
| Renovate | HIGH | 2–4h | Packages drift independently |
| SLO tracking | HIGH | 6–8h | Cannot detect degradation |
| Blue/green | MEDIUM | 8–12h | High-risk deployments |
| Load testing | MEDIUM | 12–16h | Unknown capacity limits |
| Mintlify | MEDIUM | 4–6h | Poor developer experience |
| DevTools | LOW | 8–12h | Friction on setup |
| Security automation | LOW | 12–16h | No CVE gating |

**Total: ~56–80 hours to close all gaps** (can be parallelized across 2–3 team members)
