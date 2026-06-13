import { createPublicKey, verify } from "node:crypto";

/**
 * Discord integration for Ervin — HTTP-interactions only (slash command +
 * buttons). No gateway/WebSocket worker, so it runs serverless.
 *
 * Mock mode (ERVIN_MOCK=1, DISCORD_MOCK=1, or no DISCORD_BOT_TOKEN) logs the
 * would-be calls instead of hitting Discord.
 */

const DISCORD_API = "https://discord.com/api/v10";

export function isDiscordMock(): boolean {
  return process.env.ERVIN_MOCK === "1" || process.env.DISCORD_MOCK === "1" || !process.env.DISCORD_BOT_TOKEN;
}

export type DiscordComponent = Record<string, unknown>;

export type DiscordPostInput = {
  channelId: string;
  text: string;
  components?: DiscordComponent[];
};

/** Post a message to a Discord channel (optionally with interactive components). */
export async function postMessage(input: DiscordPostInput): Promise<{ ok: boolean }> {
  if (isDiscordMock()) {
    console.log(`[discord:mock] message → #${input.channelId}: ${input.text}`);
    return { ok: true };
  }

  const res = await fetch(`${DISCORD_API}/channels/${input.channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    },
    body: JSON.stringify({ content: input.text, components: input.components }),
  });
  if (!res.ok) {
    throw new Error(`Discord message failed: ${res.status} ${await res.text()}`);
  }
  return { ok: true };
}

/** Action row with Approve / Reject buttons. runId is carried in each `custom_id`. */
export function approvalComponents(runId: string): DiscordComponent[] {
  return [
    {
      type: 1, // action row
      components: [
        { type: 2, style: 3, label: "Approve & merge", custom_id: `approve_run:${runId}` }, // green
        { type: 2, style: 4, label: "Reject", custom_id: `reject_run:${runId}` }, // red
      ],
    },
  ];
}

// SPKI DER prefix for an Ed25519 public key (RFC 8410). The 32-byte raw key follows.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function ed25519KeyFromHex(hexKey: string) {
  const der = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(hexKey, "hex")]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

/**
 * Verify a Discord interaction signature (Ed25519 over `timestamp + rawBody`).
 * In mock mode without a configured public key, verification is skipped so local
 * testing works; whenever DISCORD_PUBLIC_KEY is set it is always enforced.
 */
export function verifyDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (isDiscordMock() && !publicKey) return true;
  if (!publicKey || !signature || !timestamp) return false;

  try {
    const key = ed25519KeyFromHex(publicKey);
    const message = Buffer.from(timestamp + rawBody);
    return verify(null, message, key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}
