import { generateObject } from "ai";
import { z } from "zod";
import { primaryModel } from "@/lib/ai";

export const classificationSchema = z.object({
  category: z.enum(["bug", "feature", "chore", "incident", "question"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string().describe("One-sentence restatement of the issue."),
  reasoning: z.string().describe("Why this category and severity were chosen."),
});

export type Classification = z.infer<typeof classificationSchema>;

export type ClassifyInput = {
  title: string;
  externalIssueId?: string | null;
  body?: string | null;
};

/**
 * Classify an incoming issue. Pure: takes the issue text, returns structured
 * classification. No DB or Inngest coupling so it can be reused from the
 * `/classify` route and the state machine alike.
 */
export async function classifyIssue(input: ClassifyInput): Promise<Classification> {
  const { object } = await generateObject({
    model: primaryModel,
    schema: classificationSchema,
    system:
      "You are Ervin, an engineering-ops triage agent. Classify the incoming issue " +
      "precisely. Be conservative with severity: reserve 'critical' for outages or data loss.",
    prompt: [
      `Issue title: ${input.title}`,
      input.externalIssueId ? `External issue id: ${input.externalIssueId}` : null,
      input.body ? `Issue body:\n${input.body}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return object;
}
