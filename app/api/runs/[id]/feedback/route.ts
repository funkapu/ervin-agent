import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { accountForRequest } from "@/lib/auth/api-key";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";

/**
 * Capture a thumbs up/down (+ optional note) on a completed fix. This is the raw
 * signal that later improves prompts / seeds few-shot examples.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await accountForRequest(req);
  if (auth.unauthorized) {
    return NextResponse.json({ error: "invalid API key" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rating = body?.rating;

  if (rating !== "good" && rating !== "bad") {
    return NextResponse.json({ error: "rating must be 'good' or 'bad'" }, { status: 400 });
  }

  const run = await db.query.runs.findFirst({
    where: and(eq(runs.id, id), eq(runs.accountId, auth.account.id)),
  });
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const note = typeof body?.note === "string" ? body.note.trim() || null : null;

  const [updated] = await db
    .update(runs)
    .set({ fixRating: rating, fixFeedback: note })
    .where(eq(runs.id, id))
    .returning();

  return NextResponse.json({ ok: true, run: updated });
}
