import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Slack integration for Ervin — the chat trigger/approval surface.
 *
 * Mock mode (ERVIN_MOCK=1, SLACK_MOCK=1, or no SLACK_BOT_TOKEN) logs the
 * would-be Slack calls instead of hitting the API, so the whole flow runs
 * end-to-end without a real workspace.
 */

const SLACK_API = "https://slack.com/api";

export function isSlackMock(): boolean {
  return process.env.ERVIN_MOCK === "1" || process.env.SLACK_MOCK === "1" || !process.env.SLACK_BOT_TOKEN;
}

export type SlackBlock = Record<string, unknown>;

export type PostMessageInput = {
  channel: string;
  text: string;
  threadTs?: string | null;
  blocks?: SlackBlock[];
};

/** Post a message (optionally threaded, optionally with Block Kit blocks). */
export async function postMessage(input: PostMessageInput): Promise<{ ok: boolean; ts?: string }> {
  if (isSlackMock()) {
    console.log(
      `[slack:mock] chat.postMessage → #${input.channel}${input.threadTs ? ` (thread ${input.threadTs})` : ""}: ${input.text}`,
    );
    return { ok: true, ts: "mock-ts" };
  }

  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: input.channel,
      text: input.text,
      thread_ts: input.threadTs ?? undefined,
      blocks: input.blocks,
    }),
  });
  const json = (await res.json()) as { ok: boolean; ts?: string; error?: string };
  if (!json.ok) {
    throw new Error(`Slack chat.postMessage failed: ${json.error}`);
  }
  return { ok: true, ts: json.ts };
}

/**
 * Verify a Slack request signature (v0 scheme). Compares an HMAC-SHA256 of
 * `v0:{timestamp}:{rawBody}` against the `X-Slack-Signature` header, and rejects
 * stale timestamps (>5 min) to block replay. In mock mode we skip verification
 * so local testing without a signing secret still works.
 *
 * `nowMs` is injectable for testing; defaults to the current time.
 */
export function verifySlackSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  nowMs: number = Date.now(),
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (isSlackMock() && !signingSecret) return true;
  if (!signingSecret || !signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(nowMs / 1000 - ts) > 60 * 5) return false; // replay guard

  const expected = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Block Kit message offering Approve / Reject at the human gate. */
export function approvalBlocks(runId: string, title: string, prUrl?: string | null): SlackBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Ready for your approval* — _${title}_\nCI is green and a PR is open${prUrl ? `: <${prUrl}|view PR>` : ""}. Approve to merge, deploy, and close.`,
      },
    },
    {
      type: "actions",
      block_id: `approval_${runId}`,
      elements: [
        {
          type: "button",
          style: "primary",
          text: { type: "plain_text", text: "Approve & merge" },
          action_id: "approve_run",
          value: runId,
        },
        {
          type: "button",
          style: "danger",
          text: { type: "plain_text", text: "Reject" },
          action_id: "reject_run",
          value: runId,
        },
      ],
    },
  ];
}
