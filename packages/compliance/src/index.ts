import { sql } from '@adrper79-dot/neon';
import type { FactoryDb } from '@adrper79-dot/neon';
import { InternalError, NotFoundError, ValidationError, ErrorCodes } from '@adrper79-dot/errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Consent type — which regulation the consent record covers. */
export type ConsentType = 'TCPA' | 'FDCPA' | 'GDPR' | 'CCPA';

/** FDCPA call classification. */
export type FDCPACallType = 'initial' | 'follow_up';

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

/**
 * DDL for the `compliance_consents` table — immutable consent log.
 */
export const CREATE_COMPLIANCE_CONSENTS_TABLE = `
CREATE TABLE IF NOT EXISTS compliance_consents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  consent_type TEXT NOT NULL,
  ip_address   TEXT NOT NULL,
  user_agent   TEXT,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`.trim();

/**
 * DDL for the `compliance_contacts` table — FDCPA / TCPA contact tracking.
 */
export const CREATE_COMPLIANCE_CONTACTS_TABLE = `
CREATE TABLE IF NOT EXISTS compliance_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   TEXT NOT NULL,
  call_type    TEXT NOT NULL,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`.trim();

/**
 * DDL for the `compliance_tcpa_suppression` table.
 * A row = this phone number opted out and must not be called.
 */
export const CREATE_TCPA_SUPPRESSION_TABLE = `
CREATE TABLE IF NOT EXISTS compliance_tcpa_suppression (
  phone        TEXT PRIMARY KEY,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason        TEXT
);
`.trim();

// ---------------------------------------------------------------------------
// TCPA
// ---------------------------------------------------------------------------

/**
 * Checks whether it is safe to contact a phone number under TCPA.
 * Returns `{ safe: true }` if the number is not in the suppression list,
 * or `{ safe: false, reason }` if it is.
 *
 * @param opts - TCPA check options.
 */
export async function checkTCPA(opts: {
  phone: string;
  db: FactoryDb;
}): Promise<{ safe: boolean; reason?: string }> {
  const { phone, db } = opts;

  if (!phone) {
    throw new ValidationError('checkTCPA: phone is required');
  }

  interface SuppressionRow extends Record<string, unknown> {
    phone: string;
    reason: string | null;
  }

  const rows = await db.execute<SuppressionRow>(
    sql`SELECT phone, reason FROM compliance_tcpa_suppression WHERE phone = ${phone} LIMIT 1`,
  );

  if (rows.rows.length === 0) {
    return { safe: true };
  }

  const row = rows.rows[0];
  return {
    safe: false,
    reason: row?.reason ?? 'Number on TCPA suppression list',
  };
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

/**
 * Records an immutable consent event to `compliance_consents`.
 * This log is append-only — never update or delete rows.
 *
 * @param db - Drizzle / Neon database client.
 * @param opts - Consent details.
 */
export async function logConsent(
  db: FactoryDb,
  opts: {
    userId: string;
    consentType: ConsentType;
    ipAddress: string;
    userAgent?: string;
  },
): Promise<void> {
  const { userId, consentType, ipAddress, userAgent } = opts;

  if (!userId || !consentType || !ipAddress) {
    throw new ValidationError('logConsent: userId, consentType, and ipAddress are required');
  }

  const ua = userAgent ?? null;

  await db.execute(
    sql`INSERT INTO compliance_consents (user_id, consent_type, ip_address, user_agent)
        VALUES (${userId}, ${consentType}, ${ipAddress}, ${ua})`,
  );
}

// ---------------------------------------------------------------------------
// FDCPA
// ---------------------------------------------------------------------------

/** Minimum gap in hours between initial and follow-up contacts (FDCPA). */
const FDCPA_MIN_HOURS_BETWEEN_CONTACTS = 24;

/**
 * Validates whether contacting a person under FDCPA rules is permitted.
 * Checks: no prior contact within 24 hours for the same contactId.
 *
 * @param db - Drizzle / Neon database client.
 * @param opts - FDCPA check options.
 */
export async function checkFDCPA(
  db: FactoryDb,
  opts: { contactId: string; callType: FDCPACallType },
): Promise<{ allowed: boolean; nextAllowedAt?: Date; reason?: string }> {
  const { contactId, callType } = opts;

  if (!contactId || !callType) {
    throw new InternalError('checkFDCPA: contactId and callType are required', {
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  interface ContactRow extends Record<string, unknown> {
    contacted_at: string | Date;
  }

  // Find the most recent contact for this contactId
  const rows = await db.execute<ContactRow>(
    sql`SELECT contacted_at FROM compliance_contacts
        WHERE contact_id = ${contactId}
        ORDER BY contacted_at DESC
        LIMIT 1`,
  );

  if (rows.rows.length === 0) {
    // No prior contact — always allowed
    return { allowed: true };
  }

  const lastContactedAt = new Date(rows.rows[0]!.contacted_at as string);
  const msElapsed = Date.now() - lastContactedAt.getTime();
  const hoursElapsed = msElapsed / 3_600_000;

  if (hoursElapsed < FDCPA_MIN_HOURS_BETWEEN_CONTACTS) {
    const nextAllowedAt = new Date(
      lastContactedAt.getTime() + FDCPA_MIN_HOURS_BETWEEN_CONTACTS * 3_600_000,
    );
    const reason =
      callType === 'follow_up'
        ? `Follow-up contacts must wait ${String(FDCPA_MIN_HOURS_BETWEEN_CONTACTS)} hours after initial contact`
        : `Contact attempted within the ${String(FDCPA_MIN_HOURS_BETWEEN_CONTACTS)}-hour window`;
    return { allowed: false, nextAllowedAt, reason };
  }

  return { allowed: true };
}

/**
 * Records a contact attempt in `compliance_contacts` for FDCPA tracking.
 *
 * @param db - Drizzle / Neon database client.
 * @param opts - Contact attempt details.
 */
export async function recordContact(
  db: FactoryDb,
  opts: { contactId: string; callType: FDCPACallType },
): Promise<void> {
  const { contactId, callType } = opts;

  if (!contactId || !callType) {
    throw new InternalError('recordContact: contactId and callType are required', {
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  await db.execute(
    sql`INSERT INTO compliance_contacts (contact_id, call_type) VALUES (${contactId}, ${callType})`,
  );
}

/**
 * Adds a phone number to the TCPA suppression list.
 *
 * @param db - Drizzle / Neon database client.
 * @param phone - The phone number to suppress.
 * @param reason - Optional reason for suppression.
 */
export async function suppressPhone(
  db: FactoryDb,
  phone: string,
  reason?: string,
): Promise<void> {
  if (!phone) {
    throw new NotFoundError('suppressPhone: phone is required');
  }

  const r = reason ?? null;
  await db.execute(
    sql`INSERT INTO compliance_tcpa_suppression (phone, reason) VALUES (${phone}, ${r})
        ON CONFLICT (phone) DO NOTHING`,
  );
}
