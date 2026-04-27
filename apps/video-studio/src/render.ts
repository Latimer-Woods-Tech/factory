/**
 * Remotion render entry point — invoked by the GitHub Actions render workflow.
 *
 * Usage:
 *   node -r ts-node/register src/render.ts \
 *     --composition MarketingVideo \
 *     --props '{"appId":"prime_self","topic":"Q4 launch",...}' \
 *     --output /tmp/output.mp4
 *
 * Environment variables required:
 *   COMPOSITION_ID  — One of: MarketingVideo, TrainingVideo, WalkthroughVideo
 *   PROPS_JSON      — JSON-encoded composition props
 *   OUTPUT_PATH     — Absolute path for the rendered MP4
 */

import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function getArg(flag: string): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) {
    throw new Error(`Missing argument: ${flag}`);
  }
  return args[idx + 1] as string;
}

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

async function render(): Promise<void> {
  // Prefer CLI flags; fall back to env vars for workflow compatibility
  const compositionId =
    flagOrNull('--composition') ?? getEnv('COMPOSITION_ID');
  const propsJson =
    flagOrNull('--props') ?? getEnv('PROPS_JSON');
  const outputPath =
    flagOrNull('--output') ?? getEnv('OUTPUT_PATH');

  console.log(`[render] Composition: ${compositionId}`);
  console.log(`[render] Output: ${outputPath}`);

  let inputProps: Record<string, unknown>;
  try {
    inputProps = JSON.parse(propsJson) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JSON in props: ${propsJson}`);
  }

  // Bundle the Remotion project
  const entry = path.resolve(__dirname, 'Root.tsx');
  console.log(`[render] Bundling ${entry}…`);

  const bundleLocation = await bundle({
    entryPoint: entry,
    webpackOverride: (config) => config,
  });

  console.log(`[render] Bundle ready at ${bundleLocation}`);

  // Select the composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  console.log(
    `[render] Rendering ${String(composition.durationInFrames)} frames at ${String(composition.fps)} fps…`,
  );

  // Render to MP4
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r[render] ${String(Math.round(progress * 100))}%`);
    },
  });

  process.stdout.write('\n');
  console.log(`[render] Done → ${outputPath}`);
}

function flagOrNull(flag: string): string | null {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1] ?? null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

render().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[render] FATAL: ${message}`);
  process.exit(1);
});
