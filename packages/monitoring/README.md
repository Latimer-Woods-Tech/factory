# @factory/monitoring

Sentry + PostHog observability utilities for Factory applications running on Cloudflare Workers.

## Features

- **Sentry** — automatic error capture, performance tracing, and MCP span recording
- **PostHog** — lightweight HTTP client for event capture and user identification (no Node.js SDK)

## Sentry quick-start

```typescript
import { withSentry, createSentryCloudflareConfig } from '@latimer-woods-tech/monitoring';
import app from './app.js';
import type { Env } from './env.js';

export default withSentry(
  (env: Env) => createSentryCloudflareConfig(env.SENTRY_DSN, { tracesSampleRate: 0.1, sendDefaultPii: true }),
  app,
);
```

## PostHog quick-start

```typescript
import { initPostHog } from '@latimer-woods-tech/monitoring';

const posthog = initPostHog({ apiKey: env.POSTHOG_KEY });

// Capture a custom event
await posthog.capture('video.watched', userId, { videoId, durationMs });

// Identify a user
await posthog.identify(userId, { email, plan });
```

PostHog failures are forwarded to Sentry as warnings — they never throw or crash the host application.
