import { db } from "@/lib/db";
import { intakeFiltered, runs } from "@/lib/db/schema";
import { parseIntent } from "@/lib/agent/steps/parse-intent";
import { prefilterEnabled, shouldProcess } from "@/lib/agent/steps/prefilter";
import { getDefaultAccount } from "@/lib/auth/api-key";
import { chatColumns } from "@/lib/chat/source";
import { postToChat } from "@/lib/chat/dispatch";
import { createIssue } from "@/lib/integrations/linear";
import { type ChatIntakeData, EVENTS, inngest } from "@/lib/inngest/client";

/**
 * Chat intake: turn a free-text message (Slack or Discord) into tracked work.
 *
 * parse → (if actionable) create Linear issue(s) + run(s) → emit `run/created`
 * (the existing engine takes over) → acknowledge in-thread. Non-actionable
 * messages get a short reply and create nothing.
 *
 * Provider-agnostic: everything routes through the `ChatSource` on the event.
 * This is only a trigger surface — the bug→deploy loop itself is unchanged.
 */
export const chatIntake = inngest.createFunction(
  { id: "chat-intake", name: "Ervin Chat Intake", retries: 1, triggers: [{ event: EVENTS.chatIntake }] },
  async ({ event, step }) => {
    const { source, text } = event.data as ChatIntakeData;

    // Cheap deterministic gate BEFORE the LLM — drop obvious noise, log it as
    // labeled data. Bypass with ERVIN_PREFILTER_BYPASS=1.
    if (prefilterEnabled()) {
      const verdict = shouldProcess(text);
      if (!verdict.process) {
        await step.run("log-filtered", async () => {
          await db.insert(intakeFiltered).values({
            provider: source.provider,
            channelId: source.channelId,
            text,
            reason: verdict.reason,
          });
          console.log(`[prefilter] filtered (${verdict.reason}): ${text.slice(0, 60)}`);
        });
        await step.run("prefilter-reply", () =>
          postToChat(source, "That didn't look like an actionable task — nothing filed. Send a bug or change and I'll jump on it."),
        );
        return { filtered: true, reason: verdict.reason };
      }
      console.log(`[prefilter] processed (${verdict.reason}): ${text.slice(0, 60)}`);
    }

    const intent = await step.run("parse-intent", () => parseIntent(text));

    if (!intent.isActionable || intent.tasks.length === 0) {
      await step.run("reply-not-actionable", () =>
        postToChat(
          source,
          "I didn't spot a concrete engineering task in that — send me a bug or change to file and I'll get on it.",
        ),
      );
      return { actionable: false };
    }

    // Create an issue + run for each distinct task, then hand off to the engine.
    const created = await step.run("create-work", async () => {
      // Chat intake belongs to the default (dashboard) account until per-account
      // chat linking exists.
      const account = await getDefaultAccount();
      const out: { runId: string; identifier: string; url: string }[] = [];
      for (const task of intent.tasks) {
        const issue = await createIssue(task.title, task.description);
        const [run] = await db
          .insert(runs)
          .values({
            accountId: account.id,
            title: task.title,
            context: task.description,
            externalIssueId: issue.identifier,
            ...chatColumns(source),
          })
          .returning();
        out.push({ runId: run.id, identifier: issue.identifier, url: issue.url });
      }
      return out;
    });

    // Emit run/created for each (outside the create step so retries don't double-insert).
    for (const c of created) {
      await step.run(`start-${c.runId}`, () => inngest.send({ name: EVENTS.runCreated, data: { runId: c.runId } }));
    }

    await step.run("ack", () => {
      const lines = created.map((c) => `• Created ${c.identifier} — on it.`).join("\n");
      const suffix = created.length > 1 ? "\nI'll post here as each one progresses." : " I'll post here as it progresses.";
      return postToChat(source, `${lines}${suffix}`);
    });

    return { actionable: true, count: created.length };
  },
);
