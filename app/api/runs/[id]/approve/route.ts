import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { accountForRequest } from "@/lib/auth/api-key";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { EVENTS, inngest } from "@/lib/inngest/client";

/**
 * Human approval gate. Emits `run/approved`, which resumes the paused pipeline
 * at `step.waitForEvent` → merge → deploy → close.
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
  if (run.state !== "awaiting_approval") {
    return NextResponse.json(
      { error: `run is not awaiting approval (state: ${run.state})` },
      { status: 409 },
    );
  }

  await inngest.send({ name: EVENTS.runApproved, data: { runId: id } });

  return NextResponse.json({ ok: true, runId: id, approved: true });
}
