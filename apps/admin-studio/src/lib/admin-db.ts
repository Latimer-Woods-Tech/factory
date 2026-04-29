/**
 * Typed Drizzle client for Admin Studio operator routes.
 *
 * Separate from the untyped createDb exported by @adrper79-dot/neon so that
 * operator routes get full Drizzle query-builder inference without coupling
 * the shared neon package to any app-specific schema.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../schema.js';
import type { HyperdriveBinding } from '@adrper79-dot/neon';

export type AdminDb = ReturnType<typeof createAdminDb>;

/**
 * Creates a fully typed Drizzle client scoped to the admin-studio schema.
 *
 * @param hyperdrive - Cloudflare Hyperdrive binding (env.DB)
 * @returns Drizzle client with creator, payout, and DLQ query builders
 */
export function createAdminDb(hyperdrive: HyperdriveBinding) {
  const client = neon(hyperdrive.connectionString);
  return drizzle(client, { schema });
}

/** Re-export schema tables for use in route update/insert calls. */
export {
  creators,
  creatorConnections,
  payoutBatches,
  payouts,
  payoutDlq,
  payoutAuditLog,
} from '../schema.js';
