import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { classifyIssue } from "@/lib/agent/steps/classify";
import { accountForRequest } from "@/lib/auth/api-key";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";

/**
 * Manually (re)classify a run. Delegates to the shared `classifyIssue` step so
 * there is one source of truth shared with the state-machine pipeline.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await accountForRequest(req);
  if (auth.unauthorized) {
    return NextResponse.json({ error: "invalid API key" }, { status: 401 });
  }

  const run = await db.query.runs.findFirst({
    where: and(eq(runs.id, id), eq(runs.accountId, auth.account.id)),
  });
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const classification = await classifyIssue({
    title: run.title,
    externalIssueId: run.externalIssueId,
    body: run.context,
  });

  const [updated] = await db
    .update(runs)
    .set({ category: classification.category, severity: classification.severity })
    .where(eq(runs.id, id))
    .returning();

  return NextResponse.json({ ...updated, classification });
}
