import { generateObject } from "ai";
import { z } from "zod";
import { primaryModel } from "@/lib/ai";

export const intentSchema = z.object({
  isActionable: z
    .boolean()
    .describe("True only if this describes a concrete engineering problem or task Ervin should work on."),
  title: z.string().describe("Short issue title (empty if not actionable)."),
  description: z.string().describe("One-paragraph restatement of the problem (empty if not actionable)."),
  tasks: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .describe(
      "Usually exactly one task. Split into multiple ONLY when the message clearly describes several distinct pieces of work.",
    ),
});

export type ParsedIntent = z.infer<typeof intentSchema>;

/**
 * Parse a free-text chat message into actionable work. Pure: no DB/Slack.
 * Non-actionable chatter (greetings, questions, banter) → isActionable=false.
 */
export async function parseIntent(message: string): Promise<ParsedIntent> {
  const { object } = await generateObject({
    model: primaryModel,
    schema: intentSchema,
    system:
      "You are Ervin, an engineering-ops agent. Decide whether a chat message describes real " +
      "engineering work (a bug, a defect, a concrete change) that should become a tracked issue. " +
      "Greetings, questions, and general chatter are NOT actionable. When actionable, produce a " +
      "crisp issue title and description. Keep it to ONE task unless the message clearly lists " +
      "multiple distinct pieces of work.",
    prompt: message,
  });

  return object;
}
