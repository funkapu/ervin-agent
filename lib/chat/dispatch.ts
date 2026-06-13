import { approvalComponents, postMessage as discordPost } from "@/lib/integrations/discord";
import { approvalBlocks, postMessage as slackPost } from "@/lib/integrations/slack";
import type { ChatSource } from "./source";

/** Post a plain text message into the chat thread, routed by provider. */
export async function postToChat(source: ChatSource, text: string): Promise<void> {
  if (source.provider === "slack") {
    await slackPost({ channel: source.channelId, threadTs: source.threadRef, text });
  } else {
    await discordPost({ channelId: source.channelId, text });
  }
}

/** Post the interactive Approve/Reject prompt, routed by provider. */
export async function postApproval(
  source: ChatSource,
  runId: string,
  title: string,
  prUrl?: string | null,
): Promise<void> {
  if (source.provider === "slack") {
    await slackPost({
      channel: source.channelId,
      threadTs: source.threadRef,
      text: `Ready for approval — ${title}`,
      blocks: approvalBlocks(runId, title, prUrl),
    });
  } else {
    await discordPost({
      channelId: source.channelId,
      text: `*Ready for your approval* — ${title}${prUrl ? `\nPR: ${prUrl}` : ""}\nApprove to merge, deploy, and close.`,
      components: approvalComponents(runId),
    });
  }
}
