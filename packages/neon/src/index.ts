import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { sql } from 'drizzle-orm';
import { InternalError, ErrorCodes } from '@factory/errors';

/**
 * Drizzle client bound to a Neon HTTP connection.
 */
export type FactoryDb = NeonHttpDatabase<Record<string, never>>;

export { sql } from 'drizzle-orm';

/**
 * Minimal Cloudflare Hyperdrive-compatible binding shape.
 * Only `connectionString` is consumed.
 */
export interface HyperdriveBinding {
  readonly connectionString: string;
}

/**
 * Options accepted by {@link runMigrations}.
 */
export interface RunMigrationsOptions {
  /** Path to the folder containing Drizzle-generated SQL migration files. */
  migrationsFolder: string;
}

/**
 * Creates a Drizzle client bound to a Cloudflare Hyperdrive connection.
 *
 * @param hyperdrive - Hyperdrive binding (typically `env.DB`).
 * @returns A Drizzle client wrapping the Neon HTTP driver.
 */
export function createDb(hyperdrive: HyperdriveBinding): FactoryDb {
  if (!hyperdrive.connectionString) {
    throw new InternalError('Hyperdrive connectionString is required', {
      code: ErrorCodes.DB_CONNECTION_FAILED,
    });
  }

  const client = neon(hyperdrive.connectionString);
  return drizzle(client);
}

/**
 * Sets `app.tenant_id` for RLS policies and runs the supplied callback.
 *
 * @param db - Drizzle client returned by {@link createDb}.
 * @param tenantId - Tenant identifier injected into the RLS policy.
 * @param fn - Callback invoked with the configured client.
 * @returns The resolved value of `fn`.
 */
export async function withTenant<T>(
  db: FactoryDb,
  tenantId: string,
  fn: (db: FactoryDb) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    throw new InternalError('tenantId is required for withTenant', {
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  await db.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
  return fn(db);
}

/**
 * Applies pending Drizzle migrations to the database.
 *
 * Intended for build/deploy scripts only — the underlying migrator
 * reads SQL files from disk and is not Workers-runtime safe.
 *
 * @param db - Drizzle client returned by {@link createDb}.
 * @param options - Migration options including the migrations folder.
 */
export async function runMigrations(
  db: FactoryDb,
  options: RunMigrationsOptions,
): Promise<void> {
  await migrate(db, { migrationsFolder: options.migrationsFolder });
}