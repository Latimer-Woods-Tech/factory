import { AuthError, ErrorCodes, ForbiddenError, toErrorResponse } from '@adrper79-dot/errors';
import type { MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Auth token payload.
 */
export interface TokenPayload {
  sub: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  iat: number;
  exp: number;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TOKEN_SEPARATOR = '.';
const roleLevels: Record<TokenPayload['role'], number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

type TokenHeader = {
  alg: 'HS256';
  typ: 'JWT';
};

function toBase64Url(value: string): string {
  const bytes = encoder.encode(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/gu, '');
}

function fromBase64Url<T>(value: string): T {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return JSON.parse(decoder.decode(bytes)) as T;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signData(data: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  let binary = '';

  for (const byte of new Uint8Array(signature)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/gu, '');
}

async function parseToken(token: string, secret: string): Promise<TokenPayload> {
  const parts = token.split(TOKEN_SEPARATOR);
  if (parts.length !== 3) {
    throw new AuthError('Invalid token format', { code: ErrorCodes.AUTH_TOKEN_INVALID });
  }

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !providedSignature) {
    throw new AuthError('Invalid token format', { code: ErrorCodes.AUTH_TOKEN_INVALID });
  }
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = await signData(data, secret);

  if (providedSignature !== expectedSignature) {
    throw new AuthError('Invalid token signature', { code: ErrorCodes.AUTH_TOKEN_INVALID });
  }

  const header = fromBase64Url<TokenHeader>(encodedHeader);
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new AuthError('Invalid token header', { code: ErrorCodes.AUTH_TOKEN_INVALID });
  }

  const payload = fromBase64Url<TokenPayload>(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new AuthError('Token expired', { code: ErrorCodes.AUTH_TOKEN_EXPIRED });
  }

  return payload;
}

/**
 * Issues a signed JWT with an HMAC SHA-256 signature.
 */
export async function issueToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn = 3600,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const tokenPayload: TokenPayload = {
    ...payload,
    iat,
    exp: iat + expiresIn,
  };
  const header: TokenHeader = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(tokenPayload));
  const signature = await signData(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies a JWT signature and expiry.
 */
export async function verifyToken(token: string, secret: string): Promise<TokenPayload> {
  return parseToken(token, secret);
}

/**
 * Refreshes a valid token with a new expiry.
 */
export async function refreshToken(
  token: string,
  secret: string,
  expiresIn = 3600,
): Promise<string> {
  const payload = await verifyToken(token, secret);

  return issueToken(
    {
      sub: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    },
    secret,
    expiresIn,
  );
}

/**
 * Extracts and verifies a bearer token.
 */
export function jwtMiddleware(secret: string): MiddlewareHandler {
  return async (c, next) => {
    const authorization = c.req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      const error = new AuthError('Bearer token required', {
        code: ErrorCodes.AUTH_TOKEN_MISSING,
      });
      const response = toErrorResponse(error);

      return c.json(response, 401 as ContentfulStatusCode);
    }

    try {
      const payload = await verifyToken(authorization.slice(7), secret);
      c.set('user', payload);
      await next();
    } catch (err) {
      const authError =
        err instanceof AuthError
          ? err
          : new AuthError('Authentication failed', {
              code: ErrorCodes.AUTH_TOKEN_INVALID,
            });
      const response = toErrorResponse(authError);

      return c.json(response, 401 as ContentfulStatusCode);
    }
  };
}

/**
 * Enforces a minimum role level on a route.
 */
export function requireRole(role: TokenPayload['role']): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (roleLevels[user.role] < roleLevels[role]) {
      const error = new ForbiddenError(`Requires ${role} role`, {
        code: ErrorCodes.AUTH_FORBIDDEN,
      });
      const response = toErrorResponse(error);

      return c.json(response, 403 as ContentfulStatusCode);
    }

    await next();
  };
}
