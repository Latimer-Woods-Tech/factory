# Video Studio

Automated video render engine for Factory applications — powered by [Remotion](https://remotion.dev).

## Compositions

| ID                 | Duration | Description                                              |
| ------------------ | -------- | -------------------------------------------------------- |
| `MarketingVideo`   | 15s      | Brand-voice headline + script + animated CTA badge       |
| `TrainingVideo`    | 30s      | Step-by-step training module with sidebar navigation     |
| `WalkthroughVideo` | 40s      | Product walkthrough driven by ordered screenshot URLs    |

All compositions are parameterised by brand tokens (`brandColor`, `brandAccent`, `logoUrl`) resolved at render time.

## Development

```bash
# Install dependencies
npm install

# Open the Remotion Studio (visual editor)
npm run studio

# Type-check
npm run typecheck
```

## Render (used by GitHub Actions)

```bash
COMPOSITION_ID=MarketingVideo \
PROPS_JSON='{"appId":"prime_self","topic":"Q4 launch","script":"Raise your standard.","narrationUrl":"https://r2.example.com/narration.mp3","brandColor":"#0066FF","brandAccent":"#FF6600","logoUrl":"https://r2.example.com/logo.png"}' \
OUTPUT_PATH=/tmp/output.mp4 \
node -r ts-node/register src/render.ts
```

Or using CLI flags:

```bash
node -r ts-node/register src/render.ts \
  --composition MarketingVideo \
  --props '{"appId":"prime_self",...}' \
  --output /tmp/output.mp4
```

## Pipeline integration

The full automated pipeline:

```
PostHog signals
  → @latimer-woods-tech/schedule: scheduleVideo()
  → cron Worker: getPendingJobs() → dispatch to GitHub Actions
  → render-video.yml workflow:
      1. Generate narration (ElevenLabs)
      2. Render MP4 (Remotion → ffmpeg)
      3. Upload to Cloudflare R2
      4. Register with Cloudflare Stream
      5. Update video_calendar: updateJobStatus('done', { streamUid, videoUrl })
  → Landing page updated with new embed URL
  → PostHog tracks engagement → loop
```

## Constraints

- Runs in **GitHub Actions** only (not Cloudflare Workers — needs real Chromium + ffmpeg)
- No `process.env` for secrets — all passed as `PROPS_JSON` or workflow inputs
- Composition IDs must match `RenderJobType`: `marketing` → `MarketingVideo`, etc.
