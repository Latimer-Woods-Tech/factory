# Video Automation Gameplan
**Prime Self Training & Marketing Videos**

## Executive Summary

**Status**: Infrastructure 100% complete, needs deployment  
**Time to First Video**: 4-6 hours  
**Components**: 5 deployed artifacts + 14 GitHub Secrets

All code exists in the Factory monorepo. This is a **deployment and integration** effort, not a development effort.

---

## Current State

### ✅ Complete (Exists in Factory Repo)

| Component | Purpose | Status |
|-----------|---------|--------|
| `apps/video-studio` | Remotion compositions (3 templates) | Code complete |
| `apps/schedule-worker` | REST API for job queue | Code complete |
| `apps/video-cron` | Hourly dispatcher | Code complete |
| `.github/workflows/render-video.yml` | GitHub Actions render pipeline (12 steps) | Code complete |
| `packages/video` | Cloudflare Stream/R2 wrappers | Published to npm |
| `packages/schedule` | Database schema + queue logic | Published to npm |

### ❌ Blocked (Needs Deployment)

| Blocker | Impact | Est. Time |
|---------|--------|-----------|
| 14 GitHub Secrets not configured | Can't run render-video.yml | 30 min |
| `schedule-worker` not deployed | No job queue API | 20 min |
| `video-cron` not deployed | No automated job dispatch | 20 min |
| `video_calendar` table doesn't exist | Can't track jobs | 5 min |
| Prime Self missing `@adrper79-dot/video` + `schedule` | Can't schedule videos | 10 min |
| Prime Self UI has no Stream iframe | Can't display videos | 15 min |

**Total Deployment Time**: ~2 hours  
**First Video ETA**: 4 hours (includes manual test + verification)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     VIDEO PRODUCTION PIPELINE                    │
└─────────────────────────────────────────────────────────────────┘

TRIGGER OPTIONS:
1. Manual: POST /videos/schedule (Prime Self admin UI)
2. Automated: PostHog engagement signals → cron → schedule
3. Direct: GitHub Actions UI manual dispatch

┌──────────────────┐
│  Prime Self App  │  POST /videos/schedule
│  (scheduled or   │  { type: "training", topic: "..." }
│   manual admin)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  schedule-worker  (Cloudflare Worker)                        │
│  • Postgres: video_calendar table via Hyperdrive            │
│  • Exposes: POST /jobs, GET /jobs/pending, PATCH /jobs/:id  │
│  • Priority scoring: scorePriority(engagement, freshness)   │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  video-cron  (Cloudflare Worker)                             │
│  • Runs: Every hour                                          │
│  • Logic: fetchPendingJobs() → dispatch to GitHub Actions   │
│  • Constraint: Max 3 concurrent jobs                         │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  render-video.yml  (GitHub Actions, 12 steps)                │
│                                                               │
│  1. Checkout + Node.js setup                                 │
│  2. Install ffmpeg + Chromium (Ubuntu)                       │
│  3. Anthropic LLM → generate script.json                     │
│  4. ElevenLabs TTS → narration.mp3                           │
│  5. Upload narration to R2 → narration/{job_id}.mp3          │
│  6. Remotion render → /tmp/video_{job_id}.mp4                │
│  7. ffmpeg encode → H.264 baseline + AAC                     │
│  8. Upload video to R2 → renders/{job_id}.mp4                │
│  9. Cloudflare Stream Copy API → register video → UID        │
│  10. PATCH schedule-worker → update status to "done"         │
│  11. GitHub Actions summary with Stream UID                  │
│  12. On failure: PATCH → status "failed"                     │
│                                                               │
│  Duration: ~10-15 minutes per video                          │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Cloudflare Stream CDN                                       │
│  • Embed URL: iframe.videodelivery.net/{STREAM_UID}         │
│  • Adaptive bitrate streaming                               │
│  • Global CDN delivery                                       │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Prime Self UI  (Cloudflare Pages)                           │
│  • <iframe src="https://customer-.../{STREAM_UID}/iframe">  │
│  • Autoplay, picture-in-picture, fullscreen support         │
└──────────────────────────────────────────────────────────────┘
```

---

## Video Compositions (Remotion)

All templates: **30 FPS, 1920×1080, brand-parameterized**

### 1. `MarketingVideo` (15 seconds / 450 frames)
**Use case**: Social media teasers, ads, hero sections

```typescript
Props: {
  appId: 'prime_self',
  topic: 'Discover your Energy Blueprint',
  script: { headline, body, cta },
  narrationUrl: 'https://r2.../narration.mp3',
  brandColor: '#8B5CF6',     // Purple
  brandAccent: '#10B981',     // Green
  logoUrl: 'https://r2.../logo.png'
}
```

**Output**: 15-second teaser with headline → narration → CTA

---

### 2. `TrainingVideo` (30 seconds / 900 frames)
**Use case**: How-to tutorials, feature walkthroughs

```typescript
Props: {
  appId: 'prime_self',
  topic: 'How to read your Human Design chart',
  script: { 
    steps: [
      { title: 'Step 1', description: '...' },
      { title: 'Step 2', description: '...' }
    ]
  },
  narrationUrl: 'https://r2.../narration.mp3',
  brandColor: '#8B5CF6',
  brandAccent: '#10B981'
}
```

**Output**: Step-by-step with sidebar navigation + narration

---

### 3. `WalkthroughVideo` (40 seconds / 1200 frames)
**Use case**: Product demos, landing page hero videos

```typescript
Props: {
  appId: 'prime_self',
  topic: 'Prime Self Platform Overview',
  script: { 
    scenes: [
      { screenshot: 'dashboard.png', narration: '...' },
      { screenshot: 'report.png', narration: '...' }
    ]
  },
  narrationUrl: 'https://r2.../narration.mp3',
  screenshots: ['https://r2.../screen1.png', '...']
}
```

**Output**: Product walkthrough with screenshot transitions

---

## Deployment Checklist

### Phase 1: Configure GitHub Secrets (30 min)

**✅ COMPLETE** - All secrets configured as of April 27, 2026

**Navigate**: Factory repo → Settings → Secrets and variables → Actions

| Secret Name | Value Source | Status |
|-------------|--------------|--------|
| `ANTHROPIC_API_KEY` | Anthropic Console | ✅ Configured |
| `ELEVENLABS_API_KEY` | ElevenLabs Dashboard | ✅ Configured |
| `ELEVENLABS_VOICE_PRIME_SELF` | Eric (cjVigY5qzO86Huf0OWal) | ✅ Configured |
| `ELEVENLABS_VOICE_CYPHER` | George (JBFqnCBsd6RMkjVDRZzb) | ✅ Configured |
| `ELEVENLABS_VOICE_DEFAULT` | Alice (Xb7hH8MSUJpSbSDYk0k2) | ✅ Configured |
| `CF_API_TOKEN` | Cloudflare Dashboard → API Tokens | ✅ Configured (used for Stream + R2) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → Account ID | ✅ Configured |
| `R2_ACCESS_KEY_ID` | Set to `cloudflare` for S3 auth | ✅ Configured |
| `R2_SECRET_ACCESS_KEY` | Uses `CF_API_TOKEN` for S3 auth | ✅ Configured |
| `R2_BUCKET_NAME` | `factory-videos` | ✅ Configured |
| `R2_PUBLIC_DOMAIN` | `{account-id}.r2.cloudflarestorage.com` | ✅ Configured |
| `SCHEDULE_WORKER_URL` | `https://schedule.adrper79.workers.dev` | ✅ Configured |
| `WORKER_API_TOKEN` | Generated random token | ✅ Configured |
| `GH_PAT` | GitHub Personal Access Token | ✅ Configured (used for npm auth) |

**Voice Assignments:**
- **Prime Self**: Eric - Smooth, Trustworthy
- **Cypher of Healing**: George - Warm, Captivating Storyteller
- **Default/Fallback**: Alice - Clear, Engaging Educator

**R2 Bucket Created**:
- **Bucket**: `factory-videos` (created 2026-04-27 via automated workflow)
- **Location**: WNAM (Western North America)
- **Storage Class**: Standard
- **Authentication**: Uses CF_API_TOKEN for S3-compatible access
- **Public Domain**: `a1c8a33cbe8a3c9e260480433a0dbb06.r2.cloudflarestorage.com`

**Verification**:
```bash
# List all secrets
gh secret list --repo adrper79-dot/Factory | Select-String -Pattern "ELEVENLABS|R2_|WORKER"

# Verify R2 bucket exists
gh run list --workflow="provision-r2.yml" --limit 1
```

---

### Phase 2: Deploy schedule-worker (20 min)

**2.1 Create video_calendar table**

```bash
cd Factory/apps/schedule-worker
```

**Update `wrangler.jsonc`**:
```json
{
  "name": "schedule-worker",
  "main": "dist/index.js",
  "compatibility_date": "2024-01-01",
  "hyperdrive": [
    {
      "binding": "DB",
      "id": "YOUR_HYPERDRIVE_ID_HERE"  // ← Get from Cloudflare Dashboard
    }
  ]
}
```

**Get Hyperdrive ID**:
- Option A: Cloudflare Dashboard → Workers & Pages → Hyperdrive → Copy ID
- Option B: `wrangler hyperdrive list` (use Prime Self's existing Hyperdrive, or create new)

**Deploy**:
```bash
npm run build
wrangler deploy
# Output: Deployed schedule-worker to https://schedule.adrper79.workers.dev
```

**Add WORKER_API_TOKEN secret**:
```bash
# Use the same token from GitHub Secrets Phase 1
echo "PASTE_TOKEN_HERE" | wrangler secret put WORKER_API_TOKEN
```

**Run migration** (creates `video_calendar` table):
```bash
TOKEN=$(gh secret get WORKER_API_TOKEN --repo adrper79/Factory)

curl -X POST https://schedule.adrper79.workers.dev/migrate \
  -H "Authorization: Bearer $TOKEN" \
  --fail-with-body
```

**Verification**:
```bash
# Health check
curl https://schedule.adrper79.workers.dev/health
# Expected: 200 {"status":"ok"}

# Check pending jobs (should be empty array)
curl https://schedule.adrper79.workers.dev/jobs/pending?limit=10 \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 {"data":[]}
```

---

### Phase 3: Deploy video-cron (20 min)

**3.1 Configure wrangler.jsonc**

```bash
cd Factory/apps/video-cron
```

**Update `wrangler.jsonc`**:
```json
{
  "name": "video-cron",
  "main": "dist/index.js",
  "compatibility_date": "2024-01-01",
  "triggers": {
    "crons": ["0 * * * *"]  // Every hour at :00
  }
}
```

**3.2 Add secrets**

```bash
# schedule-worker URL
echo "https://schedule.adrper79.workers.dev" | wrangler secret put SCHEDULE_WORKER_URL

# Worker API token (same as schedule-worker)
echo "PASTE_TOKEN_HERE" | wrangler secret put WORKER_API_TOKEN

# GitHub Personal Access Token (workflow:trigger permission)
echo "PASTE_GITHUB_TOKEN" | wrangler secret put GITHUB_TOKEN

# GitHub repository (owner/repo format)
echo "adrper79/Factory" | wrangler secret put GITHUB_REPO
```

**3.3 Deploy**

```bash
npm run build
wrangler deploy
# Output: Deployed video-cron to https://video-cron.adrper79.workers.dev
```

**Verification**:
```bash
# Health check
curl https://video-cron.adrper79.workers.dev/health
# Expected: 200 {"status":"ok"}

# Tail logs to see next cron execution
wrangler tail video-cron --format pretty
# Wait for next hour (:00) to see: "No pending jobs" or "Dispatched N jobs"
```

---

### Phase 4: Prime Self Integration (30 min)

**4.1 Install dependencies**

```bash
cd prime-self
npm install @adrper79-dot/video@^0.2.0 @adrper79-dot/schedule@^0.2.0
```

**4.2 Add video scheduling endpoint**

**Create `src/routes/videos.ts`**:
```typescript
import { Hono } from 'hono';
import type { Env } from '../types';
import { scheduleVideo } from '@adrper79-dot/schedule';
import { makeDb } from '../lib/db';
import { verifyJwt } from '@adrper79-dot/auth';

export const videos = new Hono<{ Bindings: Env }>();

/**
 * POST /videos/schedule
 * Schedule a new training or marketing video
 */
videos.post('/schedule', async (c) => {
  // Auth: admin only
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Forbidden: admin access required' }, 403);
  }

  // Validate request
  const { type, topic } = await c.req.json<{
    type: 'marketing' | 'training' | 'walkthrough';
    topic: string;
  }>();

  if (!type || !topic) {
    return c.json({ error: 'Missing required fields: type, topic' }, 400);
  }

  // Schedule video
  const db = makeDb(c.env);
  const jobId = await scheduleVideo(db, {
    appId: 'prime_self',
    type,
    topic,
    triggerSource: 'manual',
  });

  return c.json({ 
    data: { 
      id: jobId,
      message: `Video scheduled: ${type} - "${topic}"` 
    } 
  }, 201);
});

/**
 * GET /videos/:jobId
 * Get video status and Stream UID
 */
videos.get('/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  
  // Fetch from Neon via makeDb
  const db = makeDb(c.env);
  const row = await db
    .selectFrom('video_calendar')
    .selectAll()
    .where('id', '=', jobId)
    .executeTakeFirst();

  if (!row) {
    return c.json({ error: 'Job not found' }, 404);
  }

  return c.json({ data: row });
});
```

**Update `src/index.ts`** (add route):
```typescript
import { videos } from './routes/videos';

// ... existing routes
app.route('/videos', videos);
```

**4.3 Deploy Prime Self Worker**

```bash
npm run build
wrangler deploy
# Output: Deployed prime-self to https://prime-self.adrper79.workers.dev
```

**Verification**:
```bash
# Get admin JWT (assuming you have a /auth/login endpoint)
TOKEN=$(curl -X POST https://prime-self.adrper79.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}' \
  | jq -r '.data.token')

# Schedule a video
curl -X POST https://prime-self.adrper79.workers.dev/videos/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "training",
    "topic": "How to interpret your Human Design gates"
  }'
# Expected: 201 {"data":{"id":"uuid","message":"Video scheduled: training - \"...\""}}

# Check job status
JOB_ID="uuid-from-above"
curl https://prime-self.adrper79.workers.dev/videos/$JOB_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 {"data":{"id":"uuid","status":"pending",...}}
```

---

### Phase 5: Generate First Video (45 min)

**5.1 Manual test via GitHub Actions UI**

1. Navigate: [Factory repo → Actions → "Render Video"](https://github.com/adrper79/Factory/actions/workflows/render-video.yml)
2. Click **"Run workflow"** dropdown
3. Fill inputs:
   - **Branch**: `main`
   - **job_id**: Generate UUID: `uuidgen` or `openssl rand -hex 16`
   - **composition_id**: `TrainingVideo`
   - **app_id**: `prime_self`
   - **topic**: `How to generate your first Energy Blueprint`
   - **brand_color**: `#8B5CF6` (Prime Self purple)
   - **brand_accent**: `#10B981` (Prime Self green)
   - **logo_url**: `https://selfprime.net/logo.png` (or upload to R2 first)
4. Click **"Run workflow"**
5. Monitor: Watch workflow progress (~10-15 minutes)

**Expected output** (GitHub Actions Summary):
```
### Video Render Complete

| Field | Value |
| --- | --- |
| Job ID | `abc123...` |
| Composition | `TrainingVideo` |
| App | `prime_self` |
| Stream UID | `xyz789...` |
| Embed URL | https://iframe.videodelivery.net/xyz789... |
```

**5.2 Verify artifacts**

```bash
# Check R2 bucket (via AWS CLI or Cloudflare Dashboard)
aws s3 ls s3://prime-self-videos/narration/ \
  --endpoint-url "https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com"
# Expected: narration/{job_id}.mp3

aws s3 ls s3://prime-self-videos/renders/ \
  --endpoint-url "https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com"
# Expected: renders/{job_id}.mp4
```

**5.3 Test Stream embed**

```bash
STREAM_UID="xyz789..."  # From GitHub Actions summary

# Direct Stream playback URL
curl -I https://customer-${CF_ACCOUNT_ID}.cloudflarestream.com/${STREAM_UID}/manifest/video.m3u8
# Expected: 200

# iframe embed URL
curl -I https://iframe.videodelivery.net/${STREAM_UID}
# Expected: 200
```

---

### Phase 6: Update Prime Self UI (15 min)

**6.1 Replace video section in HTML**

```bash
cd prime-self-ui
```

**Edit `public/index.html`** (find the video section around line 420):

**BEFORE** (broken references):
```html
<div class="landing-hero-video-wrap">
  <video
    id="hero-video"
    playsinline
    loop
    muted
    autoplay
    poster="/logo-poster-v2.jpg"
    class="landing-hero-video"
  >
    <source src="/landing-v1.mp4" type="video/mp4" />
    <source src="/logo-animation-v2.mp4" type="video/mp4" />
  </video>
  <button class="landing-hero-video-play" aria-label="Play video">
    <svg>...</svg>
  </button>
</div>
```

**AFTER** (Cloudflare Stream iframe):
```html
<div class="landing-hero-video-wrap">
  <iframe
    src="https://customer-XXXXXX.cloudflarestream.com/YOUR_STREAM_UID/iframe?muted=true&autoplay=true&loop=true&controls=false"
    style="border: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
    allowfullscreen="true"
  ></iframe>
</div>
```

**Replace placeholders**:
- `XXXXXX` → Your Cloudflare Account ID (from secrets)
- `YOUR_STREAM_UID` → Stream UID from Phase 5 (e.g., `xyz789...`)

**Optional: Remove play button** (Stream iframe has built-in controls):
```html
<!-- DELETE THIS -->
<button class="landing-hero-video-play" aria-label="Play video">
  <svg>...</svg>
</button>
```

**6.2 Deploy to Cloudflare Pages**

```bash
git add public/index.html
git commit -m "feat: integrate Cloudflare Stream video embed

Replaces missing /landing-v1.mp4 and /logo-animation-v2.mp4
with automated Stream video (WalkthroughVideo composition).

Stream UID: xyz789...
"
git push origin main
# GitHub Actions auto-deploys to Cloudflare Pages
```

**6.3 Verify deployment**

```bash
# Wait 2-3 minutes for Pages deployment
curl -I https://selfprime.net/
# Expected: 200

# Check video loads
curl -I "https://customer-XXXXXX.cloudflarestream.com/YOUR_STREAM_UID/iframe"
# Expected: 200

# Visual test: Open https://selfprime.net/ in browser
# Expected: Video autoplays in hero section
```

---

## Automated Scheduling (Future Enhancement)

Once manual workflow is verified, enable automated video generation:

### Option 1: PostHog Engagement Signals

**Add to `prime-self/src/middleware/analytics.ts`**:
```typescript
import { scheduleVideo } from '@adrper79-dot/schedule';

// After successful user action (e.g., report generated)
if (engagement.eventName === 'report_generated') {
  // Check if topic needs training video
  const topic = engagement.properties.reportType;
  
  await scheduleVideo(db, {
    appId: 'prime_self',
    type: 'training',
    topic: `Understanding your ${topic} results`,
    triggerSource: 'posthog_engagement',
    metadata: { engagementScore: 0.8 } // For priority scoring
  });
}
```

### Option 2: Admin UI

**Add to Prime Self admin dashboard**:
```html
<form action="/videos/schedule" method="POST">
  <label>
    Video Type:
    <select name="type">
      <option value="marketing">Marketing (15s)</option>
      <option value="training">Training (30s)</option>
      <option value="walkthrough">Walkthrough (40s)</option>
    </select>
  </label>
  
  <label>
    Topic:
    <input type="text" name="topic" placeholder="e.g., How to read your chart" required />
  </label>
  
  <button type="submit">Schedule Video</button>
</form>
```

### Option 3: Batch Script

**For initial content backlog**:
```bash
#!/bin/bash
# scripts/batch-schedule-videos.sh

TOKEN="your-admin-jwt"
API="https://prime-self.adrper79.workers.dev"

TOPICS=(
  "How to interpret your Human Design gates"
  "Understanding your Energy Blueprint"
  "Reading your Energy Type results"
  "Decoding your Profile numbers"
  "Your Energy Channels explained"
)

for topic in "${TOPICS[@]}"; do
  curl -X POST "$API/videos/schedule" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"training\",\"topic\":\"$topic\"}"
  
  echo "Scheduled: $topic"
  sleep 2
done
```

---

## Monitoring & Maintenance

### Health Checks

**Daily smoke tests** (add to monitoring cron):
```bash
# schedule-worker health
curl https://schedule.adrper79.workers.dev/health

# video-cron health
curl https://video-cron.adrper79.workers.dev/health

# Check pending jobs count
curl https://schedule.adrper79.workers.dev/jobs/pending?limit=1 \
  -H "Authorization: Bearer $WORKER_API_TOKEN" \
  | jq '.data | length'
```

### Sentry Alerts

**Add to Sentry project** (use `@adrper79-dot/monitoring`):
- Alert: `schedule-worker` error rate > 5% (15 min window)
- Alert: `video-cron` no successful runs in 2 hours
- Alert: `render-video.yml` failure rate > 10% (daily)

### Cost Monitoring

**Cloudflare Stream pricing**:
- Storage: $5 per 1000 minutes stored
- Delivery: $1 per 1000 minutes viewed

**GitHub Actions pricing** (self-hosted or cloud):
- Ubuntu runner: ~$0.008 per minute
- Per video: ~15 min = $0.12

**Monthly estimate** (100 videos/month):
- Rendering: $12 (100 videos × $0.12)
- Storage: $2.50 (500 minutes × $5/1000)
- Delivery: $5 (5000 views × 1 min avg × $1/1000)
- **Total**: ~$20/month

---

## Troubleshooting

### Render Fails with "Stream registration failed"

**Symptom**: Step 10 fails, `STREAM_UID` is empty

**Fix**:
```bash
# Check CF_STREAM_TOKEN permissions
curl https://api.cloudflare.com/client/v4/user/tokens/verify \
  -H "Authorization: Bearer $CF_STREAM_TOKEN"

# Expected: "status": "active", "policies": [{"permission_groups": ["Stream Edit", "Stream Read"]}]
```

If missing permissions: Generate new token with Stream:Edit + Stream:Read

---

### Cron Dispatches Job But Workflow Never Runs

**Symptom**: `video-cron` logs show "Dispatched job...", but GitHub Actions shows no new run

**Fix**:
```bash
# Check GITHUB_TOKEN permissions
gh api /user --header "Authorization: Bearer $GITHUB_TOKEN"

# Expected: Status 200, user object
```

If 401: Token expired or wrong token stored  
If 403: Token lacks `workflow` scope → generate new PAT with `workflow` permission

---

### Video Renders But UI Shows Black Screen

**Symptom**: Stream UID exists, but `<iframe>` shows nothing

**Fix**:
```bash
# Check Stream video status
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/stream/$STREAM_UID" \
  -H "Authorization: Bearer $CF_STREAM_TOKEN" \
  | jq '.result.status'

# Expected: {"state": "ready"}
```

If `"state": "inprogress"`: Stream is still processing (~2-5 min after upload)  
If `"state": "error"`: Check Stream dashboard for encoding errors

---

### Job Stuck in "rendering" Status

**Symptom**: `video_calendar` row has `status = 'rendering'` for >30 minutes

**Fix**:
```bash
# Check if workflow actually failed
gh run list --workflow=render-video.yml --limit 5

# If failed run found, manually mark as failed
curl -X PATCH "https://schedule.adrper79.workers.dev/jobs/$JOB_ID" \
  -H "Authorization: Bearer $WORKER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"failed","error":"Workflow manually aborted"}'
```

---

## Success Criteria

### Phase 1 Complete ✅
- [ ] All 14 GitHub Secrets configured
- [ ] `gh secret list` shows all secrets

### Phase 2 Complete ✅
- [ ] `schedule-worker` deployed
- [ ] `curl https://schedule.adrper79.workers.dev/health` returns 200
- [ ] `video_calendar` table exists (POST /migrate returns 200)

### Phase 3 Complete ✅
- [ ] `video-cron` deployed
- [ ] `curl https://video-cron.adrper79.workers.dev/health` returns 200
- [ ] Cron logs show "No pending jobs" every hour

### Phase 4 Complete ✅
- [ ] Prime Self has `@adrper79-dot/video` + `schedule` installed
- [ ] POST /videos/schedule returns 201 with job ID
- [ ] GET /videos/:jobId returns job status

### Phase 5 Complete ✅
- [ ] Manual GitHub Actions run completes successfully
- [ ] GitHub Actions summary shows Stream UID
- [ ] `curl -I https://iframe.videodelivery.net/{STREAM_UID}` returns 200

### Phase 6 Complete ✅
- [ ] `prime-self-ui/public/index.html` has Stream iframe
- [ ] `https://selfprime.net/` loads with video autoplay
- [ ] No 404 errors in browser console for `/landing-v1.mp4`

---

## Next Steps After First Video

1. **Generate content backlog**: Schedule 10-20 training videos via batch script
2. **Add admin UI**: Build "Schedule Video" button in Prime Self admin dashboard
3. **Enable engagement triggers**: Hook PostHog events to auto-schedule videos
4. **Set up Sentry alerts**: Monitor render failure rate + cron health
5. **Document brand guidelines**: Add to `docs/video-brand-guide.md` (colors, voiceover style, intro/outro animations)

---

## Quick Reference

### Key URLs
- **schedule-worker**: https://schedule.adrper79.workers.dev
- **video-cron**: https://video-cron.adrper79.workers.dev
- **GitHub Actions**: https://github.com/adrper79/Factory/actions/workflows/render-video.yml
- **Prime Self UI**: https://selfprime.net
- **Prime Self API**: https://prime-self.adrper79.workers.dev

### Key Commands
```bash
# Schedule a video (admin)
curl -X POST https://prime-self.adrper79.workers.dev/videos/schedule \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"type":"training","topic":"Your topic here"}'

# Check pending jobs
curl https://schedule.adrper79.workers.dev/jobs/pending?limit=10 \
  -H "Authorization: Bearer $WORKER_API_TOKEN"

# Manually trigger cron (for testing)
wrangler tail video-cron &
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/video-cron/triggers/cron"

# Check Stream video status
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/stream/$STREAM_UID" \
  -H "Authorization: Bearer $CF_STREAM_TOKEN" \
  | jq '.result.status'
```

### File Locations
- **Video compositions**: `Factory/apps/video-studio/src/compositions/`
- **Schedule API**: `Factory/apps/schedule-worker/src/index.ts`
- **Cron dispatcher**: `Factory/apps/video-cron/src/index.ts`
- **Render workflow**: `Factory/.github/workflows/render-video.yml`
- **Prime Self routes**: `prime-self/src/routes/videos.ts` (to be created)
- **Prime Self UI**: `prime-self-ui/public/index.html`

---

**Ready to start deployment? Begin with Phase 1 (GitHub Secrets).**
