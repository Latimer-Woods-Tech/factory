/**
 * Hono app type — extends env with our custom variables.
 */
import type { Env } from './env.js';
import type { EnvContext } from '@adrper79-dot/studio-core';

export interface AppVariables {
  envContext: EnvContext;
  requestId: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
