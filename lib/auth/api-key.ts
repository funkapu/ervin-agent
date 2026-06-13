import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { type Account, accounts, apiKeys } from "@/lib/db/schema";

/**
 * API-key auth for Ervin's multi-tenant surfaces (MCP + API).
 *
 * Keys look like `ervin_sk_<base64url>`. We store only a SHA-256 hash (keys are
 * high-entropy random, so a fast hash is appropriate — no password KDF needed).
 * The raw key is shown exactly once, at mint time.
 */

const KEY_PREFIX = "ervin_sk_";
const PREFIX_DISPLAY_LEN = KEY_PREFIX.length + 6; // e.g. "ervin_sk_AbC123"

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type MintResult = {
  raw: string;
  record: { id: string; accountId: string; prefix: string; label: string | null };
};

/** Create a new API key for an account. Returns the raw key (show once) + the stored record. */
export async function mintApiKey(accountId: string, label: string | null = null): Promise<MintResult> {
  const raw = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  const keyHash = hashKey(raw);
  const prefix = raw.slice(0, PREFIX_DISPLAY_LEN);

  const [record] = await db
    .insert(apiKeys)
    .values({ accountId, keyHash, prefix, label })
    .returning({ id: apiKeys.id, accountId: apiKeys.accountId, prefix: apiKeys.prefix, label: apiKeys.label });

  return { raw, record };
}

/**
 * Resolve a raw API key to its account, or null if invalid/revoked.
 *
 * Looks the key up by its display prefix, then compares the full hash in
 * constant time (`timingSafeEqual`) so a match can't be teased out by timing.
 * Updates `lastUsedAt` on success.
 */
export async function resolveAccount(rawKey: string | undefined | null): Promise<Account | null> {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;

  const prefix = rawKey.slice(0, PREFIX_DISPLAY_LEN);
  const candidateHash = hashKey(rawKey);

  // Active keys sharing this prefix (collisions astronomically unlikely, but loop anyway).
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.prefix, prefix), isNull(apiKeys.revokedAt)));

  let matched: (typeof rows)[number] | undefined;
  const candidateBuf = Buffer.from(candidateHash);
  for (const row of rows) {
    const stored = Buffer.from(row.keyHash);
    if (stored.length === candidateBuf.length && timingSafeEqual(stored, candidateBuf)) {
      matched = row;
    }
  }
  if (!matched) return null;

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, matched.id));

  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, matched.accountId) });
  return account ?? null;
}

/** Revoke a key by id (used by the eventual dashboard UI / admin script). */
export async function revokeApiKey(keyId: string): Promise<void> {
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId));
}

const DEFAULT_ACCOUNT_NAME = "Default (dashboard)";

/**
 * The account the no-auth dashboard operates as, until the OAuth login exists.
 * MCP/API clients authenticate with a real per-account key instead.
 */
export async function getDefaultAccount(): Promise<Account> {
  const existing = await db.query.accounts.findFirst({ where: eq(accounts.name, DEFAULT_ACCOUNT_NAME) });
  if (existing) return existing;
  const [created] = await db.insert(accounts).values({ name: DEFAULT_ACCOUNT_NAME }).returning();
  return created;
}

/** Extract a Bearer API key from an Authorization header, if present. */
export function bearerFromRequest(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Resolve the account for an incoming API request:
 *   - `Authorization: Bearer ervin_sk_…` → that key's account (or null if invalid).
 *   - no Authorization header → the default dashboard account (back-compat).
 *
 * Returns `{ account }` on success, or `{ account: null, unauthorized: true }`
 * when a key was supplied but didn't resolve — so callers can return a 401.
 */
export async function accountForRequest(
  req: Request,
): Promise<{ account: Account; unauthorized?: false } | { account: null; unauthorized: true }> {
  const bearer = bearerFromRequest(req);
  if (bearer) {
    const account = await resolveAccount(bearer);
    if (!account) return { account: null, unauthorized: true };
    return { account };
  }
  return { account: await getDefaultAccount() };
}
