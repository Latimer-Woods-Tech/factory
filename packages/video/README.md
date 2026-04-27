# `@adrper79-dot/video`

Cloudflare Stream and R2 client wrappers for the Factory automated video production pipeline.

## Overview

`@adrper79-dot/video` provides type-safe, platform-neutral wrappers around:

- **Cloudflare Stream REST API** — upload, retrieve, list, and delete videos
- **Cloudflare R2 bucket bindings** — store/fetch raw video files and narration audio

It is used by the `@adrper79-dot/schedule` package and the `apps/video-studio` render pipeline.

## Installation

```bash
npm install @adrper79-dot/video
```

## Environment bindings

```ts
interface VideoEnv {
  CF_ACCOUNT_ID: string;   // Cloudflare account ID
  CF_STREAM_TOKEN: string; // API token with Stream:Edit + Stream:Read
}
```

Wire these from your Hono context (`c.env`) or Worker bindings.

## Usage

### Stream API

```ts
import {
  uploadFromUrl,
  getStreamVideo,
  getStreamEmbedUrl,
  deleteStreamVideo,
} from '@adrper79-dot/video';

// Copy a rendered MP4 from R2 into Stream
const video = await uploadFromUrl(
  'https://pub.r2.dev/renders/job_01.mp4',
  { appId: 'prime_self', topic: 'Q4 launch' },
  env,
);

// Embed it on a landing page
const embedUrl = getStreamEmbedUrl(video.uid);
```

### R2 bucket binding

```ts
import { putR2Object, getR2Object } from '@adrper79-dot/video';

// Store a rendered MP4
const key = await putR2Object(env.VIDEOS_BUCKET, 'renders/job_01.mp4', arrayBuffer);

// Retrieve it for further processing
const buffer = await getR2Object(env.VIDEOS_BUCKET, 'renders/job_01.mp4');
```

### Render job type

```ts
import type { RenderJob } from '@adrper79-dot/video';
```

The `RenderJob` type flows through the entire pipeline: from the `video_calendar` schedule, through the GitHub Actions render workflow, and back into `@adrper79-dot/schedule` for status tracking.

## Constraints

- No Node.js built-ins (`fs`, `path`, `crypto`) — fully platform-neutral
- No `Buffer` — uses `ArrayBuffer` and `Uint8Array`
- All `fetch` calls include error handling
- Zero `any` in public APIs (TypeScript strict)

## License

Factory Core — internal use only.
