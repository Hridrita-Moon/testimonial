/**
 * `/api/spaces` — list owned spaces, create a new space.
 *
 *   GET  — returns the session user's spaces, newest first.
 *   POST — creates a new space for the session user, auto-seeding
 *          the 6 default `SpaceField` rows. Plan-limit gate is
 *          applied server-side via `assertCanCreateSpace`. The
 *          `publicSlug` is auto-generated from the title and a
 *          4-char suffix is appended on collision.
 *
 * Auth: `await auth()` — 401 when there is no session. The
 * `userId` is always the session's, never the body's.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { spaceInputSchema } from "@/lib/validation/space";
import {
  createSpace,
  listOwnedSpaces,
  PlanLimitError,
  SlugConflictExhaustedError,
} from "@/lib/spaces";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const spaces = await listOwnedSpaces(session.user.id);
  return NextResponse.json({ spaces });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = spaceInputSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "Validation failed",
        field: first?.path.join(".") ?? null,
        message: first?.message ?? "Invalid input",
      },
      { status: 422 },
    );
  }

  try {
    const result = await createSpace(session.user.id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof PlanLimitError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: 403 },
      );
    }
    if (e instanceof SlugConflictExhaustedError) {
      return NextResponse.json(
        { error: e.message, code: "slug_conflict" },
        { status: 500 },
      );
    }
    throw e;
  }
}
