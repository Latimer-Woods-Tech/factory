/**
 * HMAC-SHA256 helpers for Studio webhook signing/verification.
 *
 * GitHub Action signs the request body, sends the hex digest in
 * `X-Studio-Signature`. Worker recomputes and compares with constant-time.
 *
 * Web Crypto only — never `node:crypto`.
 */

const ENC = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function bytesToHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < view.length; i += 1) {
    out += view[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Sign a string body with HMAC-SHA256. Returns lowercase hex.
 */
export async function signHmac(secret: string, body: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(body));
  return bytesToHex(sig);
}

/**
 * Constant-time compare for hex strings of equal length.
 *
 * Avoids `===` short-circuit timing leak. Falls back to `false` when
 * lengths differ (a safe leak — attacker still has to brute-force length).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verify the `X-Studio-Signature` header against the body.
 *
 * Returns true on a valid signature. Never throws.
 */
export async function verifyHmac(
  secret: string,
  body: string,
  headerSig: string | null | undefined,
): Promise<boolean> {
  if (!headerSig) return false;
  const expected = await signHmac(secret, body);
  return timingSafeEqual(expected, headerSig.toLowerCase());
}
