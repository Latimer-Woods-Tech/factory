# RFC Process

**Document Version:** 1.0  
**Last Updated:** April 28, 2026  
**Audience:** Engineering, product, design, and ops teams

---

## Overview

RFC (Request for Comments) is how Factory gets alignment on major decisions **before** coding starts. It prevents surprises in design review, avoids rework, and builds team confidence.

---

## When to File an RFC

File an RFC if your work meets **any** of these criteria:

- **Scope:** >2 weeks of engineering effort
- **Multi-team:** Affects 3+ engineers or multiple packages
- **Payment/Auth:** Any changes to payment processing, auth flow, or security
- **UX/Design:** Customer-facing UX redesign or new journey
- **Operational:** Changes to infrastructure, deployment, or on-call process
- **Database:** New table schema or migration affecting multiple services
- **Business:** New feature that impacts revenue, retention, or compliance

### Examples: File an RFC

✅ "Add real-time payout status tracking" (>2 weeks, UX change, affects multiple teams)  
✅ "Migrate user auth to passwordless" (auth change, >2 weeks, affects entire platform)  
✅ "Introduce video processing queue" (architecture change, multiple services depend on it)  
✅ "Creator onboarding redesign" (UX change, new journey)  
✅ "Shift from UTC to creator's local timezone for timestamps" (data model change, affects UI + API)

### Examples: Don't file an RFC

❌ "Fix typo in error message" (trivial)  
❌ "Optimize database query performance" (technical debt, <1 week, single service)  
❌ "Update ESLint config" (internal, no UX/external API change)  
❌ "Rename variable from `userId` to `creator_id`" (refactoring, internal)

**When in doubt:** File an RFC. A 15-minute review is better than a 3-week rework.

---

## RFC Lifecycle

```
DRAFT → REVIEW → ACCEPTED → IMPLEMENTATION → IMPLEMENTED
  ↓       ↓         ↓            ↓              ↓
Create  Feedback  Merge to   Code &       Post-launch
file    & revise   main     Test        Review
(1d)    (3–5d)    (1d)      (N weeks)   + Archive
```

---

## Step 1: Draft (1 day)

### Create the RFC file

```bash
# Branch name follows pattern: rfc/NNN-kebab-case-title
git checkout -b rfc/001-payout-status-tracking

# Create file in docs/rfc/
# RFC number is assigned by tech lead when filing
cat > docs/rfc/RFC-001-payout-status-tracking.md << 'EOF'
# [Copy RFC_TEMPLATE.md and fill it out]
EOF
```

### Commit as draft

```bash
git add docs/rfc/RFC-001-payout-status-tracking.md

git commit -m "rfc: draft RFC-001 payout status tracking

- Problem: Creators wait 3–5 days for payout verification
- Solution: Real-time status page showing payout journey
- Impact: Reduces support tickets 25–40%
- Effort: 4 engineers × 3 weeks
- Status: DRAFT — seeking feedback"
```

### Self-review

Before sharing, check:

- [ ] Problem statement is clear and data-backed (not hypothetical)
- [ ] Solution is concrete, not vague ("improve UX" → ❌; "add real-time status dashboard" → ✅)
- [ ] Alternatives considered (show you thought critically)
- [ ] Success criteria are measurable
- [ ] Open questions listed (don't hide uncertainty)
- [ ] Timeline is realistic (have you asked the team?)
- [ ] Risks identified and mitigations planned

---

## Step 2: Review (3–5 days)

### Identify reviewers

**Required:**
- **Tech Lead (engineering):** Architecture, feasibility, scope
- **Product Lead:** Business alignment, prioritization
- **Design Lead (if UX changes):** Mockups, journey mapping, accessibility
- **Ops Lead (if operational impact):** Infrastructure, runbooks, on-call

**Optional:**
- Security team (if auth/payment related)
- Subject matter expert (if domain-specific)

### Share for feedback

Post in **#engineering** Slack (tag reviewers):

```
📋 **RFC-001: Payout Status Tracking (DRAFT)**

Open for review until [3 days from now, e.g., April 30].

👉 Please read: [link to RFC on branch]

**Why this matters:** Creators lose trust when they don't know where their payout is. This reduces support burden 25–40%.

**What we need:** Tech architecture feedback, product prioritization, design review on mockups (coming soon).

**Questions?** Reply in thread.
```

### Review process

**For each reviewer:**

1. **Read thoroughly** (30 min – 1 hour)
2. **Add comments** on GitHub PR (not Slack) using `suggestion:` or `question:` format
3. **Approve or request changes:**
   - ✅ Approve: "Looks good; ship it" (or approval review)
   - 🤔 Request Changes: List blockers that must be fixed before merge
   - 💬 Comment: Feedback that's nice-to-have but not blocking

**Example PR comment:**

```
> We'll batch 1000 payouts per job and retry failed ones within 24h.

**Question:** What's our SLA for retry? If a bank rejects a payout, 
do we surface it to creators immediately or after 24h? 
(Affects UX & support process)

**Suggestion:** Add "Retry failed payouts" to runbook; 
on-call might need to manually retry from admin console.
```

**Handling disagreement:**

- If a reviewer says "I disagree with this approach":
  - Have a **synchronous discussion** (5–15 min Slack or coffee chat)
  - Document the disagreement in the RFC (`## Discussions` section added)
  - RFC author makes final call (with input from leads)
  - If still blocked, escalate to Head of Engineering

### Revise based on feedback

Author updates RFC on branch:

```bash
# Add discussion section if needed
git add docs/rfc/RFC-001-payout-status-tracking.md
git commit -m "rfc(001): Address design review feedback re: mobile UI responsiveness"

# Push to trigger new CI check
git push origin rfc/001-payout-status-tracking
```

### Design review meeting (if UX involved)

If RFC has UX changes, schedule a **synchronous 30-min design review** meeting.

**Attendees:** Design lead, product, 1–2 eng leads  
**Agenda:**
- Show mockups / prototype
- Walk through user journey
- Accessibility checks
- Mobile responsiveness
- Error states & edge cases

**Outcome:** Design approval ✅ or "small tweaks needed" → author updates, re-shares

---

## Step 3: Acceptance (1 day)

### Tech lead assigns RFC number & approval

Once reviewers approve, **tech lead** assigns final RFC number (if not already assigned) and approves merge:

```bash
# Example: If this is 12th RFC filed, it's RFC-012
# Update file name and content:
mv docs/rfc/RFC-001-payout-status-tracking.md docs/rfc/RFC-012-payout-status-tracking.md
```

### Merge to main

```bash
git checkout main
git pull origin main
git merge rfc/012-payout-status-tracking

# Update status in RFC file:
# Status: accepted

git push origin main
```

### Create GitHub issue for tracking

In Factory repo, create issue:

```
Title: RFC-012: Payout Status Tracking [ACCEPTED]

Body:
RFC accepted on [date]. Ready for implementation.

📄 RFC: https://github.com/Latimer-Woods-Tech/factory/blob/main/docs/rfc/RFC-012-payout-status-tracking.md

**Implementation Tasks:**
- [ ] Spike: explore payout API rate limits (1 day)
- [ ] Design: Real-time status dashboard (3 days)
- [ ] Backend: Payout tracking table + API (4 days)
- [ ] Frontend: Status page UI + notifications (3 days)
- [ ] QA & Launch: Testing, monitoring, launch plan (2 days)

Labels: `rfc`, `accepted`, `payout`
Milestone: Q2 2026
```

---

## Step 4: Implementation (N weeks)

During implementation, **keep RFC updated** if significant changes occur:

```bash
# If you discover a better approach or hit a blocker:
git add docs/rfc/RFC-012-payout-status-tracking.md
git commit -m "rfc(012): Add implementation note re: webhooks for faster updates

During spike, found that polling API is too slow (2s latency).
Switching to Stripe webhook model for real-time updates.
This reduces latency to <100ms."

git push origin main
```

---

## Step 5: Launched → Lessons Learned

Once feature ships, **update RFC with post-launch review:**

```markdown
## Lessons Learned (Post-Launch Review)

**Shipped:** May 15, 2026

### What Went Well
- Real-time status eliminated payout confusion; support tickets ↓ 35% (vs. target 25%)
- Performance great; p99 latency 120ms (vs. target 2s)
- Creators loved the transparent journey; NPS ↑ 1.2 points

### What Were We Wrong About
- Didn't anticipate webhook delays from bank systems (sometimes 6–8 hours, not 24h)
- Had to add secondary polling fallback; more complex than RFC suggested

### Operational Changes
- Added payout webhook monitoring to on-call dashboard
- Created "Payout stuck >8h" alert + runbook

### Recommendations for Next Version
1. Explore bank API partnerships (faster webhooks)
2. Add estimated delivery time (now just shows "sent")
3. Consider SMS notifications for VIP creators

### Metrics (30 days post-launch)
- Support tickets ↓ 35%
- Creator NPS ↑ 1.2 points
- Page traffic: 45% of creators visit ≥1x/week
- Completion rate: 98% of payouts shown within 24h
```

Update status → `implemented` and close GitHub issue.

---

## RFC Governance

### Who can file an RFC?

Anyone on the team (engineers, product, design, ops). **Recommended:** Discuss with your tech lead first (5 min) to confirm it's RFC-worthy.

### Who assigns RFC numbers?

Tech lead (eng leadership). Numbers are assigned sequentially: RFC-001, RFC-002, etc.

### How do we prevent RFC overload?

- Filed RFCs is encouraged ("better to discuss before coding")
- Max ~2–3 RFCs in active review at once (prevents review fatigue)
- If queue backs up, head of engineering prioritizes which to fast-track

### Can an RFC be rejected?

Yes. If reviewers agree the approach won't work, mark status → `rejected` with reasons documented:

```markdown
## Rejection Reason

After technical review, this approach has fundamental issues:
1. Payout webhook API rate limits (1 request/sec max) insufficient for scaling to 100k creators
2. Requires infrastructure investment >[budget approved for this quarter]

**Alternative:** Approved RFC-015 explores batch processing approach instead.

**Recommendation:** Revisit in Q3 2026 if payout volume scales as projected.
```

Rejection is not failure — it's good engineering practice.

### RFC change control

If an accepted RFC needs major changes:

1. Post update in #engineering with proposed changes
2. If changes are small (implementation details): Just add note; no new review needed
3. If changes are large (timeline, scope, architecture): File RFC-002b (amendment) or use same RFC number if still in implementation phase

---

## Templates & Examples

- **RFC Template:** [RFC_TEMPLATE.md](../templates/RFC_TEMPLATE.md)
- **Example RFCs:**
  - [RFC-001: Payout Batching Fix Model](RFC-001-payout-batching-fix.md) (completed)
  - [RFC-002: Creator Onboarding Journey](RFC-002-creator-onboarding-redesign.md) (in review)

---

## Integration with Other Processes

### RFC → Definition of Ready

Once RFC is accepted, **checklist items from the RFC become DoR criteria** for related Jira/GitHub issues:

```
Definition of Ready (from RFC-012):
- [ ] RFC acceptance: RFC-012 approved
- [ ] Design review: Mockups approved by design lead
- [ ] Spike outcomes: Payout API rate limits tested
- [ ] Success metrics: PostHog dashboards configured
```

### RFC → PR Reviews

When submitting PR that implements an RFC, link to it:

```
PR title: feat(payout): Add real-time payout status tracking

Closes: #[GitHub issue created from RFC]
Related RFC: RFC-012 (https://github.com/.../docs/rfc/RFC-012-payout-status-tracking.md)
```

### RFC → Code Reviews

Code reviewers should check: "Does this implementation match the RFC?" If not, ask for clarification (RFC violated, or RFC was wrong?).

---

## FAQ

**Q: Do we need an RFC for a bug fix?**  
A: No. Bug fixes are urgent and already have context. File RFC only for intentional feature/design changes.

**Q: What if an RFC takes >5 days in review?**  
A: Escalate to Head of Engineering. Something is blocked (missing stakeholder, tooling issue, unclear requirement). Don't let RFCs sit in limbo.

**Q: Can we skip RFC and just discuss in standup?**  
A: For trivial decisions (<1 week, single engineer), yes. For anything ambiguous or multi-team, write it down. Async RFC > sync-only decisions (time zone friendly, leaves paper trail).

**Q: What if reviewers' opinions conflict (e.g., tech lead says "do it", product says "deprioritize")?**  
A: Write it down in the RFC (`## Discussions` section). RFC author (with head of eng) makes final call. Document the tradeoff; move forward.

**Q: Our RFC was implemented but the outcomes were bad. What do we do?**  
A: Add `Lessons Learned` section to the RFC; post-mortem if it was urgent/breaking. This is the point of archiving RFCs — they become organizational memory.

---

## Checklist: Filing Your First RFC

- [ ] Discuss with tech lead (5 min) — is this RFC-worthy?
- [ ] Copy [RFC_TEMPLATE.md](../templates/RFC_TEMPLATE.md) → docs/rfc/RFC-###-[kebab-case].md
- [ ] Fill all sections (problem, solution, impact, timeline, success criteria, open questions)
- [ ] Self-review checklist (problem clear? solution concrete? alternatives considered?)
- [ ] Create branch: `git checkout -b rfc/###-[kebab-case]`
- [ ] Commit: `git add docs/rfc/RFC-###-*.md && git commit -m "rfc: draft RFC-### [title]"`
- [ ] Push: `git push origin rfc/###-[kebab-case]`
- [ ] Create PR and request reviewers (tech lead, product, design if applicable)
- [ ] Share in #engineering Slack → tag reviewers
- [ ] Respond to feedback and revise (3–5 days)
- [ ] Tech lead approves + assigns final RFC number if needed
- [ ] Merge to main once approved
- [ ] Create GitHub issue for tracking
- [ ] Start implementation!

---

## Next Steps

Want to file an RFC? Follow [Checklist: Filing Your First RFC](#checklist-filing-your-first-rfc) above, or ask #engineering for help.

**Related Documents:**
- [RFC Template](../templates/RFC_TEMPLATE.md)
- [Design Review Checklist](design-review-checklist.md)
- [Definition of Ready & Done](definition-of-ready-done.md)
