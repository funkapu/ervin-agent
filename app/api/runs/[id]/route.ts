import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { accountForRequest } from "@/lib/auth/api-key";
import { db } from "@/lib/db";
import { runs, runSteps } from "@/lib/db/schema";

/** Live view of a run plus its step log — poll this to watch the loop progress. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const steps = await db
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, id))
    .orderBy(asc(runSteps.startedAt));

  return NextResponse.json({ ...run, steps });
}
