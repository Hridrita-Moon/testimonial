/**
 * `/api/widgets` — lazy-create a widget for one of the session
 * user's spaces.
 *
 *   POST  body: {
 *           spaceId: string,
 *           // optional initial config — sensible defaults if absent
 *           layout?: 'masonryAnimated' | 'masonryFixed' | 'carousel',
 *           theme?: 'light' | 'dark',
 *           scrollDirection?: 'up' | 'down',
 *           showHeart?: boolean,
 *           hideDate?: boolean,
 *           hideSource?: boolean,
 *         }
 *         200:   { widget }
 *         400:   invalid JSON
 *         401:   not signed in
 *         403:   space is owned by a different user
 *         404:   space does not exist
 *         409:   a widget already exists for this space
 *         422:   validation failed (missing or invalid field)
 *
 * The unique constraint on `Widget.spaceId` is enforced by the
 * service layer's pre-check; we surface 409 explicitly so the
 * client knows to fetch the existing widget rather than treating
 * it as a transient failure.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createWidgetForSpace,
  SpaceNotFoundError,
  WidgetAlreadyExistsError,
} from "@/lib/widgets";
import { widgetLayoutSchema } from "@/lib/validation/widget";

const createSchema = z
  .object({
    spaceId: z.string().trim().min(1, "spaceId is required"),
    layout: widgetLayoutSchema.optional(),
    theme: z.enum(["light", "dark"]).optional(),
    scrollDirection: z.enum(["up", "down"]).optional(),
    showHeart: z.boolean().optional(),
    hideDate: z.boolean().optional(),
    hideSource: z.boolean().optional(),
  })
  .strict();

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
  const parsed = createSchema.safeParse(body);
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

  // The service does its own ownership check, but a quick
  // pre-flight here lets us distinguish 403 (you don't own this
  // space) from 404 (the space doesn't exist).
  const space = await prisma.space.findUnique({
    where: { id: parsed.data.spaceId },
    select: { ownerId: true },
  });
  if (!space) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (space.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const widget = await createWidgetForSpace(
      session.user.id,
      parsed.data.spaceId,
      parsed.data,
    );
    return NextResponse.json({ widget });
  } catch (e) {
    if (e instanceof SpaceNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (e instanceof WidgetAlreadyExistsError) {
      return NextResponse.json(
        { error: "Widget already exists for this space" },
        { status: 409 },
      );
    }
    throw e;
  }
}
