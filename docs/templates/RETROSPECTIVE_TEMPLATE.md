---
title: Retrospective Template
description: Sprint retrospective format for team reflection, metric review, and continuous improvement.
---

# Sprint Retrospective Template

**Copy and fill in after each sprint (every 2 weeks).**

---

## Sprint Info

| Field | Value |
|-------|-------|
| **Sprint** | Sprint 12 (Apr 28 – May 12, 2026) |
| **Date** | Monday, May 12, 2026, 14:00 UTC |
| **Attendees** | [List 5–8 people] |
| **Facilitator** | [Tech lead or EM] |
| **Timekeeper** | [Someone] |

---

## Retrospective Format (60 minutes)

### 1. Sprint Goals & Results (5 minutes)

**Question:** What did we want to achieve?

**Expected outcomes (from sprint planning):**
- [ ] Reduce lead time from 16 days → 14 days
- [ ] Deploy weekly (not every 10 days)
- [ ] Fix 6 bugs in payment module (improve test coverage)
- [ ] Onboard 3 new creators (videoking)

**Actual outcomes:**
- ✅ Lead time: 16.1 days (in progress; -0.2 days; on track to hit by May 26)
- ✅ Deploy frequency: 1 deploy this sprint (= every 14 days) — **MISS** (target: weekly)
- ✅ Payment bugs fixed: 4 out of 6 (66%; 2 deferred to next sprint due to Stripe API latency)
- ✅ Creators onboarded: 5 (exceeded target; great work!)

**Summary:** 2 out of 4 goals hit. Payment fixes delayed by external API latency.

---

### 2. KPI Trends (5 minutes)

**Review delivery metrics from this sprint:**

| Metric | Target | Last Sprint | This Sprint | Trend |
|--------|--------|-------------|------------|-------|
| Lead Time | 14 days | 16.8 days | 16.1 days | ⬇️ Improving |
| Deploy Frequency | 7 days | 10.5 days | 14 days | ⬆️ Degrading |
| Change Failure Rate | <5% | 6.7% | 4.2% | ⬇️ Improving |
| MTTR (P1) | <30 min | 28 min | 32 min | ⬆️ Worse (1 incident) |
| Test Coverage | >90% | 87% | 88% | ⬆️ Improving |
| ESLint Errors | 0 | 0 | 0 | ➡️ Stable |

**Analysis:**
- Lead time is improving (good trend)
- Deploy frequency got worse; only 1 deploy this sprint (why?)
- Test coverage is improving; change failure rate down (good!)
- One P1 incident prolonged recovery (MTTR up; investigate response time)

---

### 3. What Went Well ✅ (10 minutes)

**Round-robin:** Each person shares 1 thing that went well.

Example answers:
- "Payment validation tests are now comprehensive; caught 2 bugs before deploy"
- "Creator onboarding flows smoothly; no support tickets"
- "Incident response was fast even though MTTR was high; team was coordinated"
- "Code review turned around in <24h consistently (thanks sarah!)"

**Count:** List all positive observations; this is what to keep doing.

---

### 4. What Could Be Better 🚀 (10 minutes)

**Round-robin:** Each person shares 1 thing that was hard or slowed us down.

Example answers:
- "Only 1 deploy all sprint; feature flags were blocked waiting for product approval"
- "Stripe API timeout on 3 PRs; lost ~6h waiting for external system"
- "PR review latency on Friday; reviewers were in standup + context switching"
- "New engineer joined; onboarding took longer than expected (no big deal, expected)"
- "Database backups took 2h Monday; we had to defer staging test run"

**Categorize:**
- **Controllable (we can fix):** Feature flag approval process, PR review latency, onboarding
- **External (outside our control):** Stripe API, Neon maintenance, vacation
- **One-off (don't need action):** New engineer onboarding, meeting conflicts

**Count:** ~5–8 items is normal. >10 suggests systemic issues.

---

### 5. Root Cause Analysis (15 minutes)

For top 2–3 "Could Be Better" items, ask **"Why?"**

**Example 1: Only 1 deploy this sprint**

```
Q: Why only 1 deploy?
A: Feature flags were blocked on product approval

Q: Why did product approval take so long?
A: Product lead was in meetings; couldn't review on time

Q: How do we prevent this?
A: Schedule feature flag review in weekly sync (5 min slot reserved)
```

→ **Action:** Add "Feature flag approvals" to weekly sync agenda

**Example 2: Stripe API timeout on 3 PRs**

```
Q: Why did Stripe timeout?
A: Their API was slow; we were rate-limited

Q: Why were we rate-limited?
A: Our payment validation retries 10x immediately instead of exponential backoff

Q: How do we prevent this?
A: Implement exponential backoff retry logic (already planned for May)
```

→ **Action:** Prioritize exponential backoff in payment refactor (already in backlog; bump up)

---

### 6. Action Items (10 minutes)

Generate 3–5 action items for next sprint. Use this format:

| Action | Owner | Priority | Target Sprint | Success Criteria |
|--------|-------|----------|---|---|
| Add "Feature flag approvals" to weekly sync agenda | alice@factory.local | P1 | May 19 | Product + eng both confirm it's on calendar |
| Implement exponential backoff in payment retries | john@factory.local | P1 | May 26 | Stripe timeouts drop to <1/week; test coverage >90% |
| Document onboarding process for new engineers | sarah@factory.local | P2 | June 2 | Next hire should onboard in <2 days |
| Increase pre-deploy test coverage to include integration tests | devops@factory.local | P1 | May 19 | Integration tests run in CI; deployed code always tested end-to-end |
| OPTIONAL: Monthly incident drill (schedule June 9) | ops@factory.local | P3 | June 9 | At least 5 people practice rollback procedure |

**Key:** Owners publicly commit. Done = tested + deployed, not just "we'll try."

---

### 7. Team Health & Morale (5 minutes)

**Quick pulse check (anonymous if preferred):**

- **How energized do you feel?** (1 = burnt out, 5 = energized)
  - Average: 3.8/5 (good; slight dip from last sprint 4.2, but normal post-incident)

- **Do you feel heard?** (1 = not at all, 5 = very much)
  - Average: 4.2/5 (good)

- **Are we shipping quality?** (1 = lots of bugs, 5 = confident)
  - Average: 4.1/5 (good; test coverage improvements helped)

**Summary:** Team morale is healthy. One incident caused slight dip, but recovery was good.

---

### 8. Next Sprint Planning (5 minutes)

**Decide:** Are action items part of next sprint, or are they ongoing?

**Next sprint goals (draft; refined in planning):**
- [ ] Deploy at least 1–2 times (vs. 1 this sprint)
- [ ] Hit all 4 payment bug fixes (defer only if Stripe still unstable)
- [ ] Reduce lead time from 16.1 → 15 days
- [ ] Maintain test coverage >90%
- [ ] Ship feature X (product priority)

---

### 9. Closing (5 minutes)

**Facilitator:**
- Thanks everyone for transparency and ideas
- Remind: Action items are commitments; check-in weekly
- Set next retro date: 2 weeks from now (May 26)
- Action: Share retro doc with wider team (post to Slack #videoking)

**Post-meeting:**
- Edit this template with actual answers
- Create GitHub issues for all P0/P1 action items
- Post summary to #videoking: "Retro complete; 5 action items assigned; team morale 3.8/5"

---

## Anti-Patterns

❌ **"Everything was fine; nothing to improve"** — Not realistic. We can always improve.  
❌ **Blaming people ("John shipped broken code")** — Focus on systems ("Our pre-deploy tests didn't catch this; let's add test X")  
❌ **Generating 15 action items** — Nobody will do them all. Focus on 3–5 highest impact.  
❌ **"Let's schedule this for next sprint"** — If it's important, do it NOW or explain why waiting is OK.  
❌ **Skipping the retro if "nothing happened"** — Even boring sprints have improvements.  

---

## Sample Completed Retro

**Sprint 12 (Apr 28 – May 12, 2026)**

**What went well:**
- ✅ Test coverage improved to 88% (was 87%)
- ✅ Creator onboarding: 5 users (target 3) 🎉
- ✅ Code reviews completed within 24h (consistent)
- ✅ Change failure rate down to 4.2% (was 6.7%)

**Could be better:**
- Only 1 deploy (external: feature flag approval process)
- Stripe API timeout killed 6h of productivity
- New engineer onboarding took 3 days (not planned for)
- Friday standup caused PR review delays

**Actions for May 19 sprint:**
1. Feature flag approvals in weekly sync (alice, P1)
2. Implement Stripe backoff retry (john, P1)
3. Onboarding runbook for new hires (sarah, P2)
4. Integrate tests in CI pre-deploy (ops, P1)
5. Monthly incident drill (ops, P3, target June 9)

**Morale:** 3.8/5 (slight dip after incident, but recovering)

**Next sprint goals:** 2 deploys, all 4 payment bugs fixed, lead time 15 days

---

## Related Docs

- [Definition of Ready & Done](../runbooks/definition-of-ready-done.md) — Sprint work standards
- [Delivery KPIs](../dashboards/delivery-kpis-template.yaml) — Metrics tracked each sprint
- [Incident Response](../runbooks/incident-response-playbook.md) — When incidents impact sprint goals
