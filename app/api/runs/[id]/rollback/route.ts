import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { accountForRequest } from "@/lib/auth/api-key";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { revertPullRequest } from "@/lib/integrations/github";
import type { RunState } from "@/lib/runs/types";

const ROLLBACK_STATES: RunState[] = ["merged", "deployed", "closed"];

/**
 * Roll back a shipped fix via a git revert PR (never a force-push). Allowed only
 * once, and only for runs that actually shipped.
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
  if (!ROLLBACK_STATES.includes(run.state)) {
    return NextResponse.json(
      { error: `run cannot be rolled back (state: ${run.state})` },
      { status: 409 },
    );
  }
  if (run.rolledBackAt) {
    return NextResponse.json({ error: "run was already rolled back" }, { status: 409 });
  }

  const { revertPrUrl } = await revertPullRequest({
    runId: run.id,
    prUrl: run.prUrl,
    baseSha: run.baseSha,
    paths: (run.fixEdits ?? []).map((f) => f.path),
  });

  const [updated] = await db
    .update(runs)
    .set({ rolledBackAt: new Date(), revertPrUrl })
    .where(eq(runs.id, id))
    .returning();

  return NextResponse.json({ ok: true, revertPrUrl, run: updated });
}
