---
name: Bug
about: Something's wrong in production or staging. Use production-incident template if it's actively affecting users.
title: "[bug] "
labels: ["bug"]
assignees: []
---

## What's broken

<!-- One sentence. User-visible symptom or system behavior. -->

## Where

<!-- Repo, file/route, environment (prod/staging/dev), affected users (all / cohort / one). -->

- Repo:
- Route/file:
- Environment:
- Affected:

## How to reproduce

1.
2.
3.

## Expected vs actual

**Expected:**

**Actual:**

## Evidence

<!-- Sentry link, log snippet, screenshot, error message. Paste, don't paraphrase. -->

```
```

## First seen

<!-- Approximate timestamp + commit SHA if known. Helps bisect. -->

- First seen:
- Suspected SHA:

## Severity

<!-- One of: low (cosmetic), medium (degraded UX, workaround exists), high (broken feature, no workaround), critical (data loss, security, prod down → use production-incident instead). -->

severity:
