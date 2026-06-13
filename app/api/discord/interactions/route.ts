import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { postMessage, verifyDiscordSignature } from "@/lib/integrations/discord";
import { EVENTS, inngest } from "@/lib/inngest/client";

// Discord interaction + response type constants.
const TYPE_PING = 1;
const TYPE_APPLICATION_COMMAND = 2;
const TYPE_MESSAGE_COMPONENT = 3;
const RESP_PONG = 1;
const RESP_CHANNEL_MESSAGE = 4;

/**
 * Single Discord interactions endpoint (HTTP, no gateway worker).
 *
 * - Verifies the Ed25519 signature on every request (mandatory).
 * - Answers the PING → PONG handshake.
 * - Handles the `/ervin <description>` slash command → enqueues `chat/intake`
 *   with a Discord `ChatSource` and acks immediately.
 * - Handles Approve/Reject buttons → `run/approved` or leave the run paused.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!verifyDiscordSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  if (interaction.type === TYPE_PING) {
    return NextResponse.json({ type: RESP_PONG });
  }

  if (interaction.type === TYPE_APPLICATION_COMMAND && interaction.data?.name === "ervin") {
    const description = interaction.data.options?.find((o) => o.name === "description")?.value ?? "";
    const channelId = interaction.channel_id ?? "";
    const user = interaction.member?.user?.id ?? interaction.user?.id ?? "unknown";

    if (description.trim() && channelId) {
      await inngest.send({
        name: EVENTS.chatIntake,
        data: {
          source: { provider: "discord" as const, channelId, threadRef: channelId },
          text: description.trim(),
          user,
        },
      });
    }
    return NextResponse.json({
      type: RESP_CHANNEL_MESSAGE,
      data: { content: "On it — I'll post here as it progresses." },
    });
  }

  if (interaction.type === TYPE_MESSAGE_COMPONENT && interaction.data?.custom_id) {
    const [action, runId] = interaction.data.custom_id.split(":");
    const channelId = interaction.channel_id ?? "";
    const userId = interaction.member?.user?.id ?? interaction.user?.id ?? "someone";

    const content = await handleButton(action, runId, channelId, userId);
    return NextResponse.json({ type: RESP_CHANNEL_MESSAGE, data: { content } });
  }

  return NextResponse.json({ type: RESP_CHANNEL_MESSAGE, data: { content: "Unhandled interaction." } });
}

async function handleButton(action: string, runId: string, channelId: string, userId: string): Promise<string> {
  const run = runId ? await db.query.runs.findFirst({ where: eq(runs.id, runId) }) : undefined;
  if (!run) return "That run no longer exists.";

  if (action === "approve_run") {
    if (run.state !== "awaiting_approval") {
      return `This run is no longer awaiting approval (state: ${run.state}).`;
    }
    await inngest.send({ name: EVENTS.runApproved, data: { runId } });
    return `👍 Approved by <@${userId}> — merging now.`;
  }

  if (action === "reject_run") {
    if (channelId) {
      await postMessage({ channelId, text: `🚫 Rejected by <@${userId}> — leaving the PR open for manual review.` });
    }
    return `Rejected — left the PR open.`;
  }

  return "Unknown action.";
}

type DiscordInteraction = {
  type: number;
  channel_id?: string;
  member?: { user?: { id: string } };
  user?: { id: string };
  data?: {
    name?: string;
    custom_id?: string;
    options?: { name: string; value: string }[];
  };
};
