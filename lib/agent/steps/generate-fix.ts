import { generateObject } from "ai";
import { z } from "zod";
import { primaryModel } from "@/lib/ai";
import type { FileContent } from "@/lib/integrations/github";

export type FileEdit = { oldText: string; newText: string };
export type FileChange = { path: string; edits: FileEdit[] };

export type GenerateFixInput = {
  title: string;
  context: string;
  /** Files the fix may touch (allowlist). */
  scopeFiles: string[];
  /** Current content of the candidate files, pinned to baseSha. */
  files: FileContent[];
};

export type GeneratedFix = {
  summary: string;
  prTitle: string;
  prBody: string;
  files: FileChange[];
  /** Paths the fix touches. */
  touchedFiles: string[];
  /** Touched paths outside the allowlist. */
  violatingPaths: string[];
  scopeViolation: boolean;
};

const fixSchema = z.object({
  summary: z.string().describe("One-sentence summary of the root cause and the fix."),
  prTitle: z.string().describe("Concise PR title."),
  prBody: z.string().describe("2–4 sentence PR description in markdown."),
  files: z
    .array(
      z.object({
        path: z.string().describe("Repo-relative path of a file to change (must be one of the allowed files)."),
        edits: z
          .array(
            z.object({
              oldText: z
                .string()
                .describe(
                  "An EXACT, uniquely-occurring snippet copied verbatim from the current file content — include enough surrounding lines that it appears exactly once.",
                ),
              newText: z.string().describe("The replacement for oldText (the fixed code)."),
            }),
          )
          .min(1),
      }),
    )
    .describe("Only the files needed to fix the bug. Omit files that don't change."),
});

/**
 * Generate a fix as structured search/replace edits against the files' CURRENT
 * content. We feed the model the actual file text so every `oldText` is a real,
 * verbatim snippet — applied later by exact match (no fragile diff parsing).
 *
 * Scope is enforced after the fact: paths outside `scopeFiles` flag a violation
 * (surfaced to the human at the gate, not auto-blocked).
 */
export async function generateFix(input: GenerateFixInput): Promise<GeneratedFix> {
  const fileBlocks = input.files
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content || "(empty / new file)"}\n\`\`\``)
    .join("\n\n");

  const { object } = await generateObject({
    model: primaryModel,
    schema: fixSchema,
    system:
      "You are Ervin, a senior engineer. Fix the bug with the smallest correct change. " +
      "Return structured search/replace edits against the CURRENT file content shown below. " +
      "Rules: (1) every `oldText` must be copied EXACTLY and VERBATIM from the shown content, " +
      "including indentation; (2) each `oldText` must occur exactly once — include enough " +
      "surrounding lines to be unique; (3) only edit files in the allowed list; (4) keep edits minimal.",
    prompt: [
      `Bug: ${input.title}`,
      "",
      "## Context",
      input.context,
      "",
      `## Allowed files (scope)\n${input.scopeFiles.map((f) => `- ${f}`).join("\n")}`,
      "",
      "## Current file content",
      fileBlocks,
    ].join("\n"),
  });

  const scope = new Set(input.scopeFiles);
  const touchedFiles = object.files.map((f) => f.path);
  const violatingPaths = touchedFiles.filter((p) => !scope.has(p));

  return {
    summary: object.summary,
    prTitle: object.prTitle,
    prBody: object.prBody,
    files: object.files,
    touchedFiles,
    violatingPaths,
    scopeViolation: violatingPaths.length > 0,
  };
}
