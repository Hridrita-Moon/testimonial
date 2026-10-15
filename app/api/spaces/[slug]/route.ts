/**
 * `/api/spaces/<slug>` — read, update, delete one of the session
 * user's spaces.
 *
 * The URL is keyed by `publicSlug` (not the internal uuid) so the
 * public submission endpoint at `/api/spaces/<slug>/testimonials`
 * and the dashboard editor share a single dynamic segment.
 *
 *   GET    — returns the space + its `SpaceField` config.
 *   PATCH  — updates the space and the three optional field rows.
 *            The three core field rows are never modified.
 *   DELETE — hard-deletes the space (cascades to fields,
 *            testimonials, embed config).
 *
 * Cross-user access (the session user is not the owner) returns
 * 404 — we never confirm the existence of another user's space.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { spaceInputSchema } from "@/lib/validation/space";
import {
  deleteSpace,
  getOwnedSpaceBySlug,
  SpaceNotFoundError,
  updateSpace,
} from "@/lib/spaces";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const space = await getOwnedSpaceBySlug(session.user.id, slug);
  if (!space) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ space });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;

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
    const result = await updateSpace(session.user.id, slug, parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof SpaceNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  try {
    await deleteSpace(session.user.id, slug);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof SpaceNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
