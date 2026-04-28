# RFC Template

Use this template for all Requests for Comments (RFCs) — major decisions that affect multiple teams or packages, payment/auth changes, UX redesigns, or work >2 weeks.

---

## Metadata

```
RFC Number:     RFC-###  (assigned by tech lead when filing)
Title:          [Clear, descriptive title]
Author:         [Your name]
Date Filed:     [Date]
Status:         draft | review | accepted | implemented | rejected
Target Ship:    [Q/Year, e.g., Q2 2026]
Updated:        [Most recent update date and what changed]
```

---

## 1. Problem Statement

**"What pain point or opportunity are we addressing?"**

Describe the current situation that motivates this RFC.

- What's broken or missing?
- How does it impact customers/creators/internal ops?
- What's the business value of fixing it?
- Are there metrics that support the problem? (e.g., "60% of creators churn within 30 days because...")

Keep this section **concrete and specific**. Avoid vague language like "improve experience" — give examples.

### Example:

**Current state:** Creators currently wait 3–5 business days for payout. They see the funds disappear from their balance immediately but don't receive them to their bank account for days.

**Pain point:** Creators lose trust in the platform ("Where's my money?"). Support tickets spike every Friday. Facebook creators prefer competitor platforms (faster payouts).

**Data:** 40% of creators who request support ask about payout status. Average support response time is 18 hours, delaying resolution.

**Opportunity:** If we can show payouts in-flight (e.g., "Sent to bank 3:22pm today"), trust increases and support volume drops.

---

## 2. Proposed Solution

**"What's the recommended approach?"**

Describe your proposed fix in enough detail that someone unfamiliar with the problem understands what you want to build.

### 2.1 Core Approach

What's the main idea? (One paragraph)

### 2.2 Implementation Strategy

- **Architecture changes:** Any new services, databases, or APIs?
- **User experience:** How will creators see this? Mockups/screenshots if applicable.
- **Technical design:** Key algorithms, data structures, or integrations.
- **Rollout plan:** Phased rollout? Feature flags? A/B test?

### 2.3 Alternatives Considered

List other approaches you thought about and **why they were rejected**.

**Format:**
- **Alternative A:** [Brief description]
  - Pros: ...
  - Cons: ...
  - **Rejected because:** ...

- **Alternative B:** [Brief description]
  - Pros: ...
  - Cons: ...
  - **Rejected because:** ...

This section shows you thought critically and builds confidence in your choice.

### 2.4 Out of Scope

What are we **explicitly not** doing in this RFC?

- Future improvements to consider
- Related problems we're acknowledging but deferring
- Intentional limitations

---

## 3. Impact Analysis

**"Who is affected? What changes?"**

### 3.1 User Impact

- Customers / app users
- Creators
- Internal admins

Describe what changes for each group. Be honest about breaking changes.

### 3.2 Team Impact

- **Engineering:** How many engineers? How long? Shared resources?
- **Product:** What's the new launch checklist? Planning required?
- **Design:** New mockups? Usability testing needed?
- **Ops:** New infrastructure? Runbooks to update? On-call changes?
- **Support:** New policies? Training required?

### 3.3 Business Impact

- Revenue implications? Customer churn? LTV changes?
- Market positioning? Legal/compliance issues?
- Cost to build and operate?

---

## 4. Timeline & Resources

**"When do we ship? How much effort?"**

### 4.1 Estimated Effort

- Engineering effort: [X engineers] × [Y weeks] = [Z person-weeks]
- Design effort: [X hours]
- QA effort: [X hours]
- Risk assessment: [Low / Medium / High] — why?

### 4.2 Milestones

| Milestone | Owner | Target Date | Notes |
|-----------|-------|-------------|-------|
| Design review complete | [Name] | [Date] | Includes mockups, accessibility audit |
| Implementation started | [Name] | [Date] | Branch cut, spikes completed |
| Alpha / internal testing | [Name] | [Date] | Feature flag enabled for team |
| Beta / limited rollout | [Name] | [Date] | [X]% of users / creators |
| General availability | [Name] | [Date] | Remove feature flag; full launch |
| Post-launch monitoring | [Name] | [Date + 2 weeks] | Metrics review; incident response |

### 4.3 Hard Dependencies

- What must be done **before** this work starts?
  - Other RFCs, packages, or infrastructure changes
  - Examples: "Requires RFC-012 (database schema migration)"

### 4.4 Soft Dependencies

- What's **nice to have** but not blocking?

### 4.5 Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Payout API rate limits exceeded | Medium | High | Batch requests; cache strategy |
| Creator confusion about new UI | Medium | Medium | In-app education; support brief |
| Database query performance | Low | High | Index new schema early; load test |

---

## 5. Success Criteria

**"How will we know this worked?"**

Define measurable, objective outcomes for the RFC.

### 5.1 Technical Success

- Performance: "p99 latency <2s for payout status queries"
- Reliability: "99.9% uptime for new payout tracking API"
- Quality: "≥80% test coverage on new code"

### 5.2 Business / User Success

- Adoption: "[X]% of creators view payout status page within 2 weeks"
- Sentiment: "Creator NPS for payout flows increases from [old] to [new]"
- Support: "Payout-related support tickets drop 30%"
- Retention: "Creator 30-day retention improves for users who view payout status"

### 5.3 Measurement Plan

- What metrics will we track?
- Where will they come from? (PostHog, Sentry, analytics tool)
- What's the success threshold?
- When will we measure? (Day 1, Week 1, Month 1)

### Example:

**Success:** Creators reduce payout-related support tickets by ≥25% within 30 days of launch, and creator NPS for payout flows increases ≥0.5 points.

**Measurement:** Daily PostHog event count for `creator_viewed_payout_status` + Zendesk ticket categorization + monthly NPS survey.

---

## 6. Open Questions

**"What do we still need to figure out?"**

List questions that haven't been answered yet. These become discussion points in the review.

### Examples:

- Q: Should we show payout history (all-time) or just current batch status?
  - A: TBD (discuss in design review)

- Q: How do we handle payouts that fail mid-batching (bank rejection)?
  - A: TBD (security/ops review needed)

- Q: Do we notify creators when payout status changes (e.g., "Initiated" → "Sent")?
  - A: TBD (product decision; notification strategy RFC-XXX pending)

---

## 7. Related RFCs & ADRs

**"What decisions does this depend on?"**

Link to RFCs or Architecture Decision Records (ADRs) that are related or blocking.

Examples:

- **Depends on:** RFC-012 "Payout Database Schema" — waiting for database schema approval before implementing UI
- **Informs:** RFC-015 "Payout Fraud Detection" — this RFC influences how fraud signals are exposed in the UI
- **Related ADR:** ADR-008 "Real-time Payout Status via WebSocket vs. Polling" — decided polling via REST; see decision record

---

## 8. Design Review Checklist (if UX changes)

If this RFC includes customer-facing UX changes, the design review must cover:

- [ ] Visual mockups / prototype (Figma or built prototype)
- [ ] Journey mapped to top 8 creators journeys (see T1.2)
- [ ] Accessibility requirements identified (WCAG 2.2 AA baseline)
- [ ] Edge cases & error states shown (network failure, no payouts, etc.)
- [ ] Mobile-first responsive strategy (if web)
- [ ] Brand consistency check (design system tokens, typography, colors)
- [ ] Instrumentation requirements (what PostHog events do we track?)
- [ ] Help text / onboarding for new UI elements

See [design-review-checklist.md](design-review-checklist.md) for full checklist.

---

## 9. Appendix (Optional)

### A. Mockups / Wireframes

[Link to Figma, Miro, or embedded screenshots]

### B. Detailed Technical Design

[Link to architecture diagrams, sequence diagrams, database schema changes, API specifications]

### C. Similar Systems (Inspiration)

- Stripe Payouts experience: https://...
- Shopify creator payouts: https://...

### D. References & Research

- Industry best practices for payout UX
- Customer interviews (if applicable)
- Competitive analysis

---

## Status Tracking & Lifecycle

**New RFC filed?**
1. Save this file as `docs/rfc/RFC-###-[title].md`
2. Open as draft on branch `rfc/###-[title]`
3. Share link in #engineering Slack thread
4. Invite reviewers (tech lead, product, design if applicable)

**Once accepted:**
1. Status → `accepted`
2. Merge to main
3. Create GitHub issue with RFC link + acceptance date
4. Add to Sprint backlog

**During implementation:**
- Update `Updated:` field if significant changes occur
- Link to GitHub PR for traceability

**Post-launch:**
- Status → `implemented`
- Add "Lessons Learned" section
- Close GitHub issue
- Archive (keep in docs/rfc/ for historical reference)

---

## RFC Guidance

For help filling this out, see [rfc-process.md](rfc-process.md).

**Questions?** File an issue or ask in #engineering.
