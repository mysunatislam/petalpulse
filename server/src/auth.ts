/**
 * Per-install tokens for the Petal AI backend.
 *
 * The app calls POST /v1/register once and gets back a token tied to a random
 * install id. Every /v1/companion call carries it as a bearer token, which
 * lets the server rate-limit each install on its own and revoke one install
 * without touching the rest. Tokens are HMAC-signed, so the server keeps no
 * table of them, and they say nothing about the person: no name, email,
 * device id or health data.
 *
 * This is not proof that the caller is the real app. For that, add Play
 * Integrity / App Attest at registration (see docs/SETUP.md).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const VERSION = 'v1';
export const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueToken(secret: string, now = Date.now()): { token: string; installId: string; expiresAt: number } {
  if (secret.length < 32) throw new Error('PETAL_TOKEN_SECRET must be at least 32 characters');
  const installId = randomBytes(16).toString('base64url');
  const payload = `${VERSION}.${installId}.${now.toString(36)}`;
  return { token: `${payload}.${sign(secret, payload)}`, installId, expiresAt: now + TOKEN_MAX_AGE_MS };
}

/** Returns the install id for a valid, unexpired, unrevoked token, otherwise null. */
export function verifyToken(secret: string, token: string | undefined, now = Date.now(), revoked: ReadonlySet<string> = new Set()): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [v, installId, issued, mac] = parts;
  const expected = Buffer.from(sign(secret, `${v}.${installId}.${issued}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const issuedAt = parseInt(issued, 36);
  if (!Number.isFinite(issuedAt) || issuedAt > now + 60_000 || now - issuedAt > TOKEN_MAX_AGE_MS) return null;
  if (revoked.has(installId)) return null;
  return installId;
}

export function bearer(header: string | undefined): string | undefined {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return m?.[1];
}

/** Sliding-window limiter keyed by install id (or IP for registration). */
export function createLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 50_000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return arr.length > max;
  };
}
