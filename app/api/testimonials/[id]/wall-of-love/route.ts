/**
 * POST /api/testimonials/<id>/wall-of-love
 *
 * Toggles the testimonial's `isWallOfLove` flag. Body:
 *   { wallOfLove: boolean }
 *
 * Cross-user access returns 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { wallOfLoveSchema } from "@/lib/validation/inbox";
import { setWallOfLove, TestimonialNotFoundError } from "@/lib/testimonials";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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
  const parsed = wallOfLoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 422 });
  }
  try {
    await setWallOfLove(session.user.id, id, parsed.data.wallOfLove);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TestimonialNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
