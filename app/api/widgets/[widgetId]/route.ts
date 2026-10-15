/**
 * `/api/widgets/<widgetId>` — read, update, and delete a single
 * widget by its public id.
 *
 *   GET     200: { widget }
 *           401/404 as below
 *   PATCH   body: widgetInputSchema (5 fields, all required)
 *           200:  { widget }
 *           400:  invalid JSON
 *           401:  not signed in
 *           404:  widget not found OR owned by a different user
 *           422:  validation failed
 *   DELETE  204
 *           401/404 as below
 *
 * The route is keyed by the public `widgetId` (not the internal
 * uuid) because the embed URL is keyed by `widgetId`; the public
 * id is the addressable thing.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { widgetInputSchema } from "@/lib/validation/widget";
import {
  deleteWidget,
  getOwnedWidget,
  updateWidget,
  WidgetNotFoundError,
} from "@/lib/widgets";

interface RouteParams {
  params: Promise<{ widgetId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { widgetId } = await params;
  const widget = await getOwnedWidget(session.user.id, widgetId);
  if (!widget) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ widget });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { widgetId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = widgetInputSchema.safeParse(body);
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
    const widget = await updateWidget(session.user.id, widgetId, parsed.data);
    return NextResponse.json({ widget });
  } catch (e) {
    if (e instanceof WidgetNotFoundError) {
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
  const { widgetId } = await params;
  try {
    await deleteWidget(session.user.id, widgetId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof WidgetNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
