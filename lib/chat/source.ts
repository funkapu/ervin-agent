/** Provider-agnostic handle for the chat thread a run was started from. */

export type ChatProvider = "slack" | "discord";

export type ChatSource = {
  provider: ChatProvider;
  channelId: string;
  /** Thread/message anchor to reply under (Slack thread_ts; Discord channel/thread id). */
  threadRef: string;
};

/** The run columns the chat layer reads. */
export type ChatRun = {
  chatProvider: string | null;
  chatChannelId: string | null;
  chatThreadRef: string | null;
};

/** Build a ChatSource from a run row, or null if the run wasn't started from chat. */
export function chatSourceFromRun(run: ChatRun): ChatSource | null {
  if ((run.chatProvider === "slack" || run.chatProvider === "discord") && run.chatChannelId && run.chatThreadRef) {
    return { provider: run.chatProvider, channelId: run.chatChannelId, threadRef: run.chatThreadRef };
  }
  return null;
}

/** Map a ChatSource back to the run columns to persist. */
export function chatColumns(source: ChatSource) {
  return {
    chatProvider: source.provider,
    chatChannelId: source.channelId,
    chatThreadRef: source.threadRef,
  };
}
