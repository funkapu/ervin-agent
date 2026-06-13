import { NextResponse } from "next/server";
import { verifySlackSignature } from "@/lib/integrations/slack";
import { EVENTS, inngest } from "@/lib/inngest/client";

/**
 * Slack Events API endpoint.
 *
 * - Verifies the request signature on every call (mandatory).
 * - Answers the one-time `url_verification` challenge.
 * - For app_mentions (any channel) and plain messages in `SLACK_CHANNEL_ID`,
 *   enqueues a `chat/intake` event and returns 200 immediately (Slack needs a
 *   response within 3s; the real work happens in the Inngest function).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-slack-signature");
  const timestamp = req.headers.get("x-slack-request-timestamp");

  if (!verifySlackSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as SlackEventEnvelope;

  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Slack retries non-2xx within ~3s; we always 200, but skip re-processing retries.
  if (req.headers.get("x-slack-retry-num")) {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;
  if (event && shouldHandle(event)) {
    await inngest.send({
      name: EVENTS.chatIntake,
      data: {
        source: {
          provider: "slack" as const,
          channelId: event.channel,
          threadRef: event.thread_ts ?? event.ts,
        },
        text: stripMentions(event.text ?? ""),
        user: event.user ?? "unknown",
      },
    });
  }

  return NextResponse.json({ ok: true });
}

function shouldHandle(event: SlackEvent): boolean {
  // Never react to our own / other bots' messages — avoids feedback loops.
  if (event.bot_id || event.subtype) return false;
  if (!event.text?.trim()) return false;

  if (event.type === "app_mention") return true;
  if (event.type === "message") {
    const channelFilter = process.env.SLACK_CHANNEL_ID;
    return !channelFilter || event.channel === channelFilter;
  }
  return false;
}

/** Strip `<@U123>` user-mention tokens (e.g. the bot mention) from the text. */
function stripMentions(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/g, "").trim();
}

type SlackEvent = {
  type: string;
  channel: string;
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
};

type SlackEventEnvelope = {
  type: string;
  challenge?: string;
  event?: SlackEvent;
};
