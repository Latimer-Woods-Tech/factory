---
name: Production Incident
about: Active production issue affecting users. File this even before you know the cause; iterate as you investigate.
title: "[incident] "
labels: ["incident", "priority:P0"]
assignees: ["adrper79-dot"]
---

<!--
File this immediately when prod is degraded or down.
Do not wait until you understand the cause. The issue is the audit log.
Update it in-place as you investigate; don't open a second issue.
-->

## TL;DR

<!-- 1-2 sentences. What's broken, who sees it, what was tried. -->

## Status

- [ ] Detected
- [ ] Diagnosed
- [ ] Mitigated (users no longer affected)
- [ ] Resolved (root cause fixed, monitoring confirms healthy)
- [ ] Postmortem published

current state:

## Timeline (UTC)

| Time | Event |
|---|---|
|  | Detection |
|  |  |
|  |  |

## Impact

- **Users affected:**
- **Duration:**
- **Revenue impact (if known):**
- **Data loss (if any):**

## Suspected cause

<!-- Update as investigation progresses. "Unknown" is a valid first answer. -->

## Mitigation steps taken

1.
2.

## Root cause (filled in post-mitigation)

## Action items

<!-- Concrete follow-ups: tests to add, monitors to wire, runbooks to update. Each becomes its own issue. -->

- [ ]
- [ ]
- [ ]

## Postmortem

<!-- Link to postmortem doc once written. Postmortems for sev-high+ incidents are required within 5 business days. -->
