/**
 * `/api/testimonials/<id>` — read, edit, delete one of the
 * session user's testimonials.
 *
 *   GET    — returns the testimonial.
 *   PATCH  — updates contributor name/email/text/rating/extras.
 *            Visibility flags are NOT editable here — they have
 *            their own per-action routes
 *            (`/favorite`, `/wall-of-love`, `/visibility`).
 *   DELETE — hard-deletes the row.
 *
 * Cross-user access (the testimonial is not owned by the session
 * user) returns 404 — we never confirm the existence of another
 * user's testimonial.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { editTestimonialSchema } from "@/lib/validation/inbox";
import {
  deleteTestimonial,
  getOwnedTestimonial,
  TestimonialNotFoundError,
  updateTestimonial,
} from "@/lib/testimonials";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const t = await getOwnedTestimonial(session.user.id, id);
  if (!t) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ testimonial: t });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = editTestimonialSchema.safeParse(body);
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
    const t = await updateTestimonial(session.user.id, id, parsed.data);
    return NextResponse.json({ testimonial: t });
  } catch (e) {
    if (e instanceof TestimonialNotFoundError) {
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
  const { id } = await params;
  try {
    await deleteTestimonial(session.user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof TestimonialNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
