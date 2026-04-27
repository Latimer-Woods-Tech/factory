# Changelog — `@adrper79-dot/schedule`

All notable changes to this package will be documented in this file.

## [0.2.0] — 2025-01-01

### Added
- `VIDEO_CALENDAR_DDL` — Ready-to-run SQL DDL for the `video_calendar` table with indexes
- `scheduleVideo` — Insert a new production job from a `ProductionBrief`
- `getVideoJob` — Retrieve a single job by UUID
- `getPendingJobs` — Fetch prioritised pending queue (ordered by score desc, age asc)
- `updateJobStatus` — Update pipeline status and optional media URLs
- `scorePriority` — Pure priority score function driven by PostHog engagement metrics
- `setPerformanceScore` — Persist a computed score to the database
- `toRenderJob` — Convert a `VideoCalendarRow` to a `RenderJob` for workflow dispatch
- `ProductionBrief`, `VideoCalendarRow`, `TriggerSource`, `EngagementMetrics` types
- Full re-export of `RenderJob`, `RenderJobType`, `RenderJobStatus` from `@adrper79-dot/video`
