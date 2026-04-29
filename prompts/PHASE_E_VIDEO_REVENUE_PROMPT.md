# Phase E Video and Revenue Proof Prompt

Use this prompt for Factory video automation, Stream/R2 rendering, SelfPrime embed, revenue evidence, or related workflow fixes.

## Mission

Prove the hardest production paths before scaling app delivery: schedule job → cron dispatch → GitHub Actions render → LLM script → narration → Remotion/ffmpeg → R2 upload → Cloudflare Stream → schedule status update → SelfPrime embed/event evidence.

## Required preflight

1. Read `CLAUDE.md` Video Production Pipeline section.
2. Read `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md` Phase E and OWR rows.
3. Read `docs/service-registry.yml` entries for `schedule-worker`, `video-cron`, `synthetic-monitor`, and `prime-self-ui`.
4. Inspect `.github/workflows/render-video.yml`, `apps/video-cron/src/index.ts`, `apps/schedule-worker/src/index.ts`, and `apps/video-studio/` files relevant to the change.
5. Run `git status -sb` and avoid generated artifacts.

## Non-negotiable controls

- Render work stays in GitHub Actions, never Cloudflare Workers.
- Workers dispatch and record state only; they do not run Chromium or ffmpeg.
- Every dispatched job must have an idempotency key and state transition evidence.
- `render-video.yml` must use concurrency keyed by job ID.
- All external calls must check response status and preserve actionable error context.
- R2/Stream/ElevenLabs/GitHub failures must produce traceable failure state.
- No private chart payloads or sensitive user content may be stored in shared queues.

## Verification gates

| Gate | Required proof |
|---|---|
| Worker health | `curl` returns `200` for `schedule-worker`, `video-cron`, and `synthetic-monitor` where relevant |
| Job migration | Migration workflow run ID and response body captured |
| Render | `render-video.yml` run ID succeeds and publishes Stream UID |
| Storage | R2 upload key and Cloudflare Stream UID recorded |
| Embed | SelfPrime/Pages URL returns expected HTTP status and Stream iframe is present |
| Observability | Job ID/correlation path appears in logs, event payload, or workflow summary |
| Failure recovery | Failed render marks schedule row failed or enters documented replay path |

## Output requirements

Return:

1. What changed.
2. Which workflow/run IDs prove it.
3. Which endpoint checks were observed.
4. Which artifacts were produced.
5. What remains unresolved.
6. Whether dashboard OWR rows were updated.
