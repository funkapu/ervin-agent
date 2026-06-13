import type { SimilarRun } from "@/lib/agent/similar";
import type { RepoContext } from "@/lib/integrations/github";
import type { Classification } from "./classify";

export type BuildContextInput = {
  title: string;
  externalIssueId?: string | null;
  body?: string | null;
  classification: Classification;
  repo: RepoContext;
  similarRuns?: SimilarRun[];
};

/**
 * Smart Context Builder.
 *
 * Assembles everything the fix step needs into a single markdown blob:
 * the issue, the classification, repo conventions, a relevant file listing,
 * recent commits, and semantically similar prior runs (pgvector retrieval).
 */
export function buildContext(input: BuildContextInput): string {
  const { title, externalIssueId, body, classification, repo, similarRuns = [] } = input;

  const similarList = similarRuns.length
    ? similarRuns.map((r) => `- ${r.identifier ?? r.id.slice(0, 8)} — ${r.title} (${r.summary})`).join("\n")
    : "- (none found yet)";

  const fileList = repo.files.length
    ? repo.files.map((f) => `- ${f}`).join("\n")
    : "- (no files available)";
  const commitList = repo.recentCommits.length
    ? repo.recentCommits.map((c) => `- ${c.sha} ${c.message}`).join("\n")
    : "- (no recent commits available)";

  return [
    `# Context for: ${title}`,
    "",
    "## Issue",
    `- Title: ${title}`,
    externalIssueId ? `- External id: ${externalIssueId}` : "- External id: (none)",
    body ? `\n${body}` : "",
    "",
    "## Classification",
    `- Category: ${classification.category}`,
    `- Severity: ${classification.severity}`,
    `- Summary: ${classification.summary}`,
    `- Reasoning: ${classification.reasoning}`,
    "",
    "## Repo conventions",
    repo.conventions,
    "",
    "## Relevant files",
    fileList,
    "",
    "## Recent commits",
    commitList,
    "",
    "## Similar past runs",
    similarList,
    "",
  ].join("\n");
}
