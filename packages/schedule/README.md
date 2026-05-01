# `@latimer-woods-tech/schedule`

Automated video production calendar for the Factory content flywheel.

## Overview

`@latimer-woods-tech/schedule` manages the `video_calendar` Postgres table and provides the scheduling, queue, and priority-scoring logic that drives the fully automated video pipeline.

**Pipeline:**  
PostHog signals → `scorePriority` → `scheduleVideo` → cron queue → GitHub Actions render → `updateJobStatus` → Cloudflare Stream embed

## Installation

```bash
npm install @latimer-woods-tech/schedule
```

## Database setup

Run the DDL once during bootstrap or migration:

```ts
import { VIDEO_CALENDAR_DDL } from '@latimer-woods-tech/schedule';
await db.execute(VIDEO_CALENDAR_DDL);
```

The `video_calendar` table schema:

| Column             | Type        | Description                                          |
| ------------------ | ----------- | ---------------------------------------------------- |
| `id`               | UUID        | Primary key                                          |
| `app_id`           | TEXT        | Factory application identifier                       |
| `type`             | TEXT        | `marketing` \| `training` \| `walkthrough`           |
| `topic`            | TEXT        | Short topic for the LLM script generator             |
| `script`           | TEXT        | Full narration script (populated after LLM call)     |
| `narration_url`    | TEXT        | R2 key or URL of the ElevenLabs audio file           |
| `video_url`        | TEXT        | R2 key or URL of the rendered MP4                    |
| `stream_uid`       | TEXT        | Cloudflare Stream UID after registration             |
| `scheduled_at`     | TIMESTAMPTZ | When the video should go live                        |
| `status`           | TEXT        | `pending` → `rendering` → `uploading` → `done`      |
| `performance_score`| INTEGER     | Priority score 0–100 (higher = rebuild sooner)       |
| `trigger_source`   | TEXT        | `cron` \| `git_tag` \| `feedback_threshold` \| `manual` |
| `error`            | TEXT        | Failure reason when `status = 'failed'`              |

## Usage

### Schedule a video

```ts
import { scheduleVideo } from '@latimer-woods-tech/schedule';

const job = await scheduleVideo(db, {
  appId: 'prime_self',
  type: 'marketing',
  topic: 'Q4 launch — peak performance challenge',
  triggerSource: 'cron',
});
```

### Process the queue (cron trigger)

```ts
import { getPendingJobs, updateJobStatus, toRenderJob } from '@latimer-woods-tech/schedule';

const pending = await getPendingJobs(db, 5);
for (const row of pending) {
  await updateJobStatus(db, row.id, 'rendering');
  const job = toRenderJob(row);
  await triggerGitHubActionsRenderWorkflow(job); // your dispatch function
}
```

### Score videos by engagement

```ts
import { scorePriority, setPerformanceScore } from '@latimer-woods-tech/schedule';

const score = scorePriority({
  completionRate: 40,   // % of viewers who finished
  ctaClickRate: 10,     // % who clicked CTA
  uniqueViewers: 5000,
  ageInDays: 90,
});
await setPerformanceScore(db, jobId, score);
```

## Trigger sources

| Source               | When used                                              |
| -------------------- | ------------------------------------------------------ |
| `cron`               | Daily/weekly Cloudflare Workers cron schedule          |
| `git_tag`            | After a new release is deployed (product demos update) |
| `feedback_threshold` | When PostHog engagement drops below SLO                |
| `manual`             | API call from an operator                              |

## License

Factory Core — internal use only.
