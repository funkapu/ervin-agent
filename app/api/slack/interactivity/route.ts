import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { postMessage, verifySlackSignature } from "@/lib/integrations/slack";
import { EVENTS, inngest } from "@/lib/inngest/client";

/**
 * Slack interactivity endpoint — handles the Approve / Reject buttons posted at
 * the approval gate. Signature-verified like the events endpoint.
 *
 * Approve → emits `run/approved` (the engine resumes to merge/deploy/close).
 * Reject → leaves the run paused at the gate for manual handling.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-slack-signature");
  const timestamp = req.headers.get("x-slack-request-timestamp");

  if (!verifySlackSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Interactivity payloads arrive as `application/x-www-form-urlencoded` with a
  // single `payload` field holding the JSON.
  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get("payload") ?? "{}") as InteractionPayload;
  const action = payload.actions?.[0];

  if (!action) {
    return NextResponse.json({ ok: true });
  }

  const runId = action.value;
  const channel = payload.channel?.id;
  const threadTs = payload.message?.thread_ts ?? payload.message?.ts ?? null;
  const userId = payload.user?.id ?? "someone";

  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!run) {
    return NextResponse.json({ ok: true });
  }

  if (action.action_id === "approve_run") {
    if (run.state === "awaiting_approval") {
      await inngest.send({ name: EVENTS.runApproved, data: { runId } });
      if (channel) {
        await postMessage({ channel, threadTs, text: `👍 Approved by <@${userId}> — merging now.` });
      }
    } else if (channel) {
      await postMessage({ channel, threadTs, text: `This run is no longer awaiting approval (state: ${run.state}).` });
    }
  } else if (action.action_id === "reject_run" && channel) {
    await postMessage({
      channel,
      threadTs,
      text: `🚫 Rejected by <@${userId}> — leaving the PR open for manual review.`,
    });
  }

  return NextResponse.json({ ok: true });
}

type InteractionPayload = {
  user?: { id: string };
  channel?: { id: string };
  message?: { ts: string; thread_ts?: string };
  actions?: { action_id: string; value: string }[];
};
