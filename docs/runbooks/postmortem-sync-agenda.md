---
title: Postmortem Sync Agenda
description: Meeting structure and checklist for P1/P2 incident postmortem reviews.
---

# Postmortem Sync Agenda

**Last Updated:** April 28, 2026  
**Phase:** Phase D (T5.3)  
**Owner:** Tech lead + On-call

---

## When to Hold a Postmortem

- **P1 incidents:** Always (within 24 hours of resolution)
- **P2 incidents:** Always (within 48 hours of resolution)
- **P3 incidents:** Optional (only if process gap is discovered)

---

## Attendees

**Essential (always required):**
- Tech lead for affected service
- On-call who responded
- Incident commander (if different from on-call)

**Recommended (if available):**
- Product lead (to discuss impact)
- Ops engineer (for infrastructure insights)
- Engineer who shipped code (if different from on-call)
- Customer success lead (to share customer feedback)

**Optional:**
- Wider team (post recording later)

---

## Meeting Structure

**Duration:** 45 minutes  
**Location:** Zoom (recorded)  
**Agenda:**

### 1. Warm-up (5 minutes)

**Facilitator:** Tech lead

- "Thanks everyone for responding quickly"
- Reminder: This is **blameless**; focus on systems, not people
- Ground rule: "We're here to learn, not to assign blame"
- Ensure recording is on; mention it will be shared with wider team

---

### 2. Incident Review (10 minutes)

**Facilitator:** On-call

Go through the [`POSTMORTEM_TEMPLATE.md`](POSTMORTEM_TEMPLATE.md) document:

- **Timeline:** When did each thing happen?
- **Detection:** How were we alerted?
- **Response:** What actions were taken in what order?
- **Recovery:** When was service restored?

**Attendee questions:** "I wasn't aware of X; explain how you knew that?"

*Keep this section factual; no analysis yet.*

---

### 3. Root Cause Analysis (15 minutes)

**Facilitator:** Tech lead + on-call

**5 Whys exercise (done together):**

- **Q1:** Why did the incident happen? (technical)
- **Q2:** Why did that technical thing happen? (process/systems)
- **Q3–Q5:** Go deeper until hitting a **system** that needs fixing

**Example:**
```
Q1: Why was error rate 45%?
A: Payment validation rejecting string amounts

Q2: Why was validation rejecting strings?
A: Type coercion bug in validator

Q3: Why wasn't this caught before deploy?
A: No test case for string amounts

Q4: Why no test case?
A: Developer missed edge case

Q5: Why did developer miss it?
A: No agreed-upon test taxonomy or PR review checklist for payment module
```

**Root cause:** Missing PR review checklist for payment endpoints + incomplete test coverage

**Facilitator job:** Keep asking "why" until hitting a system you can fix, not a person.

---

### 4. Action Items (10 minutes)

**Facilitator:** Tech lead

**From root cause, generate action items using this template:**

```
Action: [Specific, testable task]
Owner: [Single owner; public commitment]
Priority: P0 (blocking, do before next deploy) | P1 (this sprint) | P2 (next sprint) | P3 (backlog)
Target Date: [Specific date; can be updated later]
Success Criteria: [How do we know it's done?]
```

**Example:**

| Action | Owner | Priority | Target Date | Success Criteria |
|--------|-------|----------|-------------|-----------------|
| Add string amount test case to `test/payment.test.ts` | jane@factory.local | P0 | Tue EOD | Test case passes; CI gates on it |
| Enable integration tests in pre-deploy CI check | devops@factory.local | P0 | Wed EOD | Payment integration tests run on every commit |
| Add "payment system review checklist" to PR template | john@factory.local | P1 | Thu EOD | PR template includes: "[]  Tested with string amounts" |
| OPTIONAL: Post incident learnings to #engineering | alice@factory.local | P2 | Thu EOD | Slack post written; 5+ 👍 reactions |

**Key decision:** Are any of these **P0 blocking**? If yes, they must be done before the next production deploy.

---

### 5. Approval & Ownership (5 minutes)

**Facilitator:** Tech lead

**Round-robin confirmation:**

- "Tech lead, do you accept this RCA?" ✓
- "On-call, do you agree with action items?" ✓
- "Product lead, any concerns?" ✓
- "Ops, any infrastructure risks?" ✓

If anyone says "wait", pause and discuss. Consensus should be reached.

**Decision:** Who owns the postmortem document? (Usually tech lead edits + publishes)

---

## Post-Meeting

### Immediately After

1. **Edit postmortem document** with action items and owner names
2. **Publish postmortem** to shared doc (not encrypted; team can see)
3. **Create GitHub issues** for each P0 action item and assign owner
4. **Post to Slack #incidents:** "Postmortem for [incident] is complete and shared; P0 action items assigned"

### By Next Day

1. **Record**: Make video recording available to team (if not autorecorded)
2. **Share learnings**: Post executive summary to all-hands or #engineering
3. **Update docs**: If action items indicate process improvements (e.g., "update PR template"), do that now
4. **Track action items**: Link GitHub issues in postmortem doc; check weekly

---

## Typical Attack Surface for RCA

When you can't figure out the root cause, check these systems first:

1. **Testing:** Were tests sufficient? Did pre-deploy check include this?
2. **Code review:** Was the code change reviewed? Did reviewers have domain expertise?
3. **Deployment process:** Was there a pre-deploy checklist? Were staging tests run?
4. **Runbooks:** Did responders know what to do? Were runbooks clear?
5. **Monitoring:** Was the issue detected fast enough? Were alerts configured?
6. **Documentation:** Was there a wiki page explaining this system? Did on-call know where to look?
7. **Communication:** Was the team aware of this known risk? Was there an RFC or decision log?
8. **On-call training:** Had the on-call practiced this scenario? Did they have all access needed?

**Often the answer is not "the developer was careless" but "the system didn't guide the developer correctly."**

---

## Anti-Patterns to Avoid

❌ **"We need better developers"** — No. Find what the system didn't prevent.  
❌ **"This was a one-off; ship a fix and move on"** — No. If it happened, it can happen again.  
❌ **"We should have stricter code review"** — Maybe, but who defines "strict"? Add checkpoints to process.  
❌ **"Person X should have known better"** — Even if true, fix the system so the next person doesn't struggle.  
❌ **"Let's add a 'don't do this' warning to the docs"** — Docs are rarely read. Fix the process or tooling instead.

---

## Postmortem Checklist

Before ending the meeting, verify:

- [ ] Timeline is complete (every key event documented)
- [ ] Root cause identified (and it's a **system**, not a person)
- [ ] Action items assigned (each has owner + priority + target date)
- [ ] P0 items have GitHub issues (assigned + linked from postmortem)
- [ ] Action items are specific + testable (not vague)
- [ ] Team agrees on next steps
- [ ] Postmortem document is shared (accessible to team)
- [ ] Recording will be shared (if not already)
- [ ] Learnings will be communicated (date + channel?)

---

## Sample Postmortem Sync (Executed)

**Meeting:** 2026-04-29 10:00 UTC (45 min)  
**Incident:** Payment validation reject all string amounts  
**Attendees:** john (on-call), jane (tech lead), alice (product)

**Timeline Review (5 min):**
- 2026-04-28 14:20: Deploy merged
- 2026-04-28 14:22: Sentry alert fired
- 2026-04-28 14:27: Rollback triggered
- 2026-04-28 14:30: Service recovered

**5 Whys (10 min):**
- Q: Why 45% error rate?
- A: Validation rejecting strings
- Q: Why rejecting strings?
- A: parseInt instead of parseFloat
- Q: Why parseInt?
- A: Type misunderstanding
- Q: Why didn't tests catch this?
- A: No test with string input
- Q: Why no test with strings?
- A: Not in test taxonomy; nobody documented what to test

**Actions (10 min):**
- **P0:** Add string test + update CI (jane + devops, done by Wed)
- **P1:** Update PR template (john, done by Thu)
- **P2:** Post learnings to Slack (alice, done by Thu)

**Approval (5 min):**
- ✓ All agree; no concerns

**Post-meeting:** jane edits postmortem, creates GitHub issues, posts to #incidents by end of day

---

## Related Docs

- [Postmortem Template](POSTMORTEM_TEMPLATE.md) — Document to fill in
- [Incident Response Playbook](incident-response-playbook.md) — How incidents are handled
- [Rollback Runbook](rollback-runbook.md) — How to revert bad changes
- [Definition of Ready & Done](../runbooks/definition-of-ready-done.md) — Process improvements often start here
