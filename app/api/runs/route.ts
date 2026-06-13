import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { accountForRequest } from "@/lib/auth/api-key";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { EVENTS, inngest } from "@/lib/inngest/client";

export async function GET(req: Request) {
  const auth = await accountForRequest(req);
  if (auth.unauthorized) {
    return NextResponse.json({ error: "invalid API key" }, { status: 401 });
  }

  const all = await db
    .select()
    .from(runs)
    .where(eq(runs.accountId, auth.account.id))
    .orderBy(desc(runs.createdAt));
  return NextResponse.json(all);
}

export async function POST(req: Request) {
  const auth = await accountForRequest(req);
  if (auth.unauthorized) {
    return NextResponse.json({ error: "invalid API key" }, { status: 401 });
  }

  const body = await req.json();
  if (!body?.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const [run] = await db
    .insert(runs)
    .values({
      accountId: auth.account.id,
      title: body.title,
      externalIssueId: body.externalIssueId ?? null,
    })
    .returning();

  // Kick off the durable pipeline.
  await inngest.send({ name: EVENTS.runCreated, data: { runId: run.id } });

  return NextResponse.json(run, { status: 201 });
}
