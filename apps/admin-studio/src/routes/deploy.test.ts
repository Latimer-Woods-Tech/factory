import { describe, expect, it } from 'vitest';
import { DEPLOY_TARGETS, buildDeployPlan } from './deploy.js';

describe('deploy route helpers', () => {
  it('defines expected workflow targets', () => {
    expect(Object.keys(DEPLOY_TARGETS).sort()).toEqual([
      'admin-studio',
      'admin-studio-ui',
      'schedule-worker',
      'synthetic-monitor',
      'video-cron',
    ]);
  });

  it('builds env-input plan for workflows that support env input', () => {
    const plan = buildDeployPlan('admin-studio', 'staging');
    expect(plan).toEqual({
      app: 'admin-studio',
      targetEnv: 'staging',
      ref: 'main',
      workflow: 'deploy-admin-studio.yml',
      inputs: { env: 'staging' },
    });
  });

  it('builds no-input plan for workflows without env input', () => {
    const plan = buildDeployPlan('video-cron', 'production', 'release/v1');
    expect(plan).toEqual({
      app: 'video-cron',
      targetEnv: 'production',
      ref: 'release/v1',
      workflow: 'deploy-video-cron.yml',
    });
  });

  it('returns null for unsupported app or invalid env', () => {
    expect(buildDeployPlan('prime-self', 'staging')).toBeNull();
    expect(buildDeployPlan('admin-studio', 'local')).toBeNull();
  });
});
