import { and, cosineDistance, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { runEmbeddings, runs } from "@/lib/db/schema";
import { touchedFiles } from "@/lib/runs/diff";

export type SimilarRun = {
  id: string;
  title: string;
  identifier: string | null;
  summary: string;
};

/**
 * Top-K prior **shipped** runs (closed/merged/deployed) most similar to the
 * given embedding, by cosine distance. Excludes the run itself and is scoped to
 * a single account — an account never sees another account's prior runs.
 */
export async function findSimilarRuns(
  runId: string,
  embedding: number[],
  accountId: string,
  k = 3,
): Promise<SimilarRun[]> {
  const distance = cosineDistance(runEmbeddings.embedding, embedding);

  const rows = await db
    .select({ id: runs.id, title: runs.title, identifier: runs.externalIssueId, diff: runs.diff })
    .from(runEmbeddings)
    .innerJoin(runs, eq(runs.id, runEmbeddings.runId))
    .where(
      and(
        ne(runs.id, runId),
        eq(runs.accountId, accountId),
        inArray(runs.state, ["closed", "merged", "deployed"]),
      ),
    )
    .orderBy(distance)
    .limit(k);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    identifier: r.identifier,
    summary: summarizeChange(r.diff),
  }));
}

function summarizeChange(diff: string | null): string {
  if (!diff) return "fix shipped";
  const files = touchedFiles(diff);
  return files.length ? `touched ${files.slice(0, 3).join(", ")}` : "fix shipped";
}
