import { postApproval, postToChat } from "@/lib/chat/dispatch";
import { type ChatRun, chatSourceFromRun } from "@/lib/chat/source";

/** Minimal run shape the notifier needs (works with the full Run row too). */
export type NotifiableRun = ChatRun & {
  id: string;
  title: string;
  externalIssueId: string | null;
  prUrl?: string | null;
};

function label(run: NotifiableRun): string {
  return run.externalIssueId ?? run.title;
}

/** Post a thread update for a meaningful transition. No-op if the run isn't from chat. */
export async function notifyTransition(
  run: NotifiableRun,
  state: "building_context" | "pr_open",
  extra?: { prUrl?: string | null },
): Promise<void> {
  const source = chatSourceFromRun(run);
  if (!source) return;

  const text =
    state === "building_context"
      ? `🔎 Building context for ${label(run)}…`
      : `🔧 Opened a PR for ${label(run)}${extra?.prUrl ? `: ${extra.prUrl}` : ""}. Running CI…`;

  await postToChat(source, text);
}

/** Post the interactive Approve/Reject message at the gate. */
export async function notifyApproval(run: NotifiableRun, prUrl?: string | null): Promise<void> {
  const source = chatSourceFromRun(run);
  if (!source) return;
  await postApproval(source, run.id, run.title, prUrl);
}

/** Post the close-out when the run reaches `closed`. */
export async function notifyClosed(run: NotifiableRun, prUrl?: string | null): Promise<void> {
  const source = chatSourceFromRun(run);
  if (!source) return;
  await postToChat(source, `✅ Merged, deployed, and closed ${label(run)}${prUrl ? ` — PR: ${prUrl}` : ""}`);
}
