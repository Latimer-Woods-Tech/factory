import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(process.cwd(), '..', '..');
const registryPath = resolve(workspaceRoot, 'docs', 'service-registry.yml');
const appRegistryPath = resolve(process.cwd(), 'src', 'lib', 'app-registry.ts');

const registryRaw = readFileSync(registryPath, 'utf8');
const appRegistryRaw = readFileSync(appRegistryPath, 'utf8');

const WORKER_IDS = ['admin-studio-staging', 'admin-studio-production', 'prime-self', 'schedule-worker', 'video-cron'];

function parseWorker(workerId) {
  const escapedId = workerId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const blockRe = new RegExp(`- id: ${escapedId}[\\s\\S]*?(?=\\n\\s*- id: |\\n\\s*pages:|$)`);
  const block = registryRaw.match(blockRe)?.[0];
  if (!block) {
    throw new Error(`Missing worker in docs/service-registry.yml: ${workerId}`);
  }

  const name = block.match(/\n\s*name:\s*([^\s#]+)/)?.[1] ?? null;
  const url = block.match(/\n\s*url:\s*([^\s#]+)/)?.[1] ?? null;
  const customDomain = block.match(/\n\s*custom_domain:\s*([^\s#]+)/)?.[1] ?? null;
  return { workerId, name, url, customDomain };
}

const workers = Object.fromEntries(WORKER_IDS.map((id) => {
  const parsed = parseWorker(id);
  return [id, parsed];
}));

const expected = [
  {
    id: 'admin-studio',
    productionWorkerName: workers['admin-studio-production'].name,
    stagingWorkerName: workers['admin-studio-staging'].name,
    productionCustomDomain: null,
  },
  {
    id: 'prime-self',
    productionWorkerName: workers['prime-self'].name,
    stagingWorkerName: workers['prime-self'].name,
    productionCustomDomain: workers['prime-self'].customDomain === 'null' ? null : workers['prime-self'].customDomain,
  },
  {
    id: 'schedule-worker',
    productionWorkerName: workers['schedule-worker'].name,
    stagingWorkerName: workers['schedule-worker'].name,
    productionCustomDomain: null,
  },
  {
    id: 'video-cron',
    productionWorkerName: workers['video-cron'].name,
    stagingWorkerName: workers['video-cron'].name,
    productionCustomDomain: null,
  },
];

const expectedSnippets = expected.map((app) => {
  const lines = [
    `id: '${app.id}'`,
    `productionWorkerName: '${app.productionWorkerName}'`,
    `stagingWorkerName: '${app.stagingWorkerName}'`,
  ];
  if (app.productionCustomDomain) {
    lines.push(`productionCustomDomain: '${app.productionCustomDomain}'`);
  }
  return lines;
});

for (const lines of expectedSnippets) {
  for (const line of lines) {
    if (!appRegistryRaw.includes(line)) {
      throw new Error(`app-registry.ts drift detected: expected snippet not found -> ${line}`);
    }
  }
}

console.log('Service registry check passed for app-registry.ts');
