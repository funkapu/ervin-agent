import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Waitlist signup. Validates the email, inserts it, and is idempotent: a
 * duplicate returns success silently (no error, no leak of who's already on).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }

  await db.insert(waitlist).values({ email }).onConflictDoNothing({ target: waitlist.email });

  return NextResponse.json({ ok: true });
}
