/**
 * Service layer for embed widgets.
 *
 * One widget per space. The widget has a stable public `widgetId`
 * (12 chars, base36) that is used in the embed URL — it must
 * survive the underlying database id, the space id, and renames.
 * Routes keyed by `widgetId` (not the internal uuid) so a widget's
 * public id is the addressable thing.
 *
 * All ownership checks derive from `widget.space.ownerId === userId`.
 * Cross-user access surfaces as `WidgetNotFoundError` → 404 (we
 * never confirm the existence of another user's widget).
 */

import { prisma } from "@/lib/prisma";
import type { WidgetInput } from "@/lib/validation/widget";
import { pickLayout } from "@/lib/widget-layouts";

/** Length of the public `widgetId` (base36). 12 chars ≈ 62 bits. */
const WIDGET_ID_LEN = 12;
const MAX_ATTEMPTS = 5;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export class WidgetNotFoundError extends Error {
  constructor() {
    super("Widget not found");
    this.name = "WidgetNotFoundError";
  }
}

export class SpaceNotFoundError extends Error {
  constructor() {
    super("Space not found");
    this.name = "SpaceNotFoundError";
  }
}

export class WidgetAlreadyExistsError extends Error {
  constructor() {
    super("Widget already exists for this space");
    this.name = "WidgetAlreadyExistsError";
  }
}

function randomWidgetId(): string {
  let s = "";
  for (let i = 0; i < WIDGET_ID_LEN; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

/**
 * Probe Prisma and return a `widgetId` that is not yet used. On
 * collision we generate a new one; with 62^12 ≈ 3e21 candidates
 * the chance of a real collision is negligible, but the probe
 * keeps the contract safe.
 */
async function ensureUniqueWidgetId(): Promise<string> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = randomWidgetId();
    const existing = await prisma.widget.findUnique({
      where: { widgetId: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error(`Could not produce a unique widgetId after ${MAX_ATTEMPTS} attempts`);
}

/** Shape returned by the manager — all fields the dashboard
 *  needs to render one Wall of Love card. `layout` defaults to
 *  `masonryAnimated` so a row missing the column (older DB
 *  snapshot) still works. */
export interface OwnedWallWidget {
  widgetId: string;
  theme: "light" | "dark";
  layout: "masonryAnimated" | "masonryFixed" | "carousel";
  scrollDirection: "up" | "down";
  showHeart: boolean;
  hideDate: boolean;
  hideSource: boolean;
}

/**
 * Shape used by `/dashboard/wall-of-love` to render one "wall" per
 * space. We deliberately only return spaces that have at least
 * one `isWallOfLove = true` testimonial — empty placeholder cards
 * have no business on the manager page. The `wallTestimonials`
 * array is the slice of testimonials currently on the wall
 * (pre-ordered, top 3 + a "more" count), and `widget` may be null
 * for a space that has wall testimonials but no embed widget yet
 * (the owner can still view and edit the testimonials via inbox).
 */
export interface OwnedWallSpace {
  id: string;
  title: string;
  publicSlug: string;
  ratingEnabled: boolean;
  widget: OwnedWallWidget | null;
  totalOnWall: number;
  featured: FeaturedTestimonial[];
  allOnWallIds: string[];
}

export interface FeaturedTestimonial {
  id: string;
  contributorName: string;
  testimonialText: string;
  rating: number | null;
  additionalValues: unknown;
  isFavorite: boolean;
  submissionTimestamp: string;
}

const widgetSelect = {
  id: true,
  widgetId: true,
  theme: true,
  layout: true,
  scrollDirection: true,
  showHeart: true,
  hideDate: true,
  hideSource: true,
} as const;

function toOwnedWidget(row: {
  widgetId: string;
  theme: string;
  layout: string | null;
  scrollDirection: string;
  showHeart: boolean;
  hideDate: boolean;
  hideSource: boolean;
}): OwnedWallWidget {
  return {
    widgetId: row.widgetId,
    theme: (row.theme as "light" | "dark") ?? "light",
    layout: pickLayout(row.layout),
    scrollDirection: (row.scrollDirection as "up" | "down") ?? "up",
    showHeart: row.showHeart,
    hideDate: row.hideDate,
    hideSource: row.hideSource,
  };
}

/**
 * List every owned space that has at least one testimonial
 * currently opted into the Wall of Love (`isWallOfLove = true`
 * AND `visibilityStatus = 'published'`). For each, load the
 * widget config (if any) and a preview slice of testimonials.
 *
 * The query is a single round-trip per space using
 * `findMany({ where: { ownerId }, include: { widget, ... } })`
 * with an in-memory filter for "has at least one wall
 * testimonial" so we never serialize a space that has no wall
 * content. The featured list is capped at 3 to keep the
 * dashboard card compact; the rest of the IDs are still
 * returned so the manager can show an "N more" badge.
 */
export async function listOwnedWalls(userId: string): Promise<OwnedWallSpace[]> {
  const spaces = await prisma.space.findMany({
    where: {
      ownerId: userId,
      testimonials: {
        some: { isWallOfLove: true, visibilityStatus: "published" },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      ratingEnabled: true,
      widget: { select: widgetSelect },
      testimonials: {
        where: { isWallOfLove: true, visibilityStatus: "published" },
        orderBy: [{ isFavorite: "desc" }, { submissionTimestamp: "desc" }],
        select: {
          id: true,
          contributorName: true,
          testimonialText: true,
          rating: true,
          additionalValues: true,
          isFavorite: true,
          submissionTimestamp: true,
        },
      },
    },
  });

  return spaces.map((s): OwnedWallSpace => {
    const totalOnWall = s.testimonials.length;
    const featured = s.testimonials.slice(0, 3).map((t) => ({
      id: t.id,
      contributorName: t.contributorName,
      testimonialText: t.testimonialText,
      rating: t.rating,
      additionalValues: t.additionalValues,
      isFavorite: t.isFavorite,
      submissionTimestamp: t.submissionTimestamp.toISOString(),
    }));
    const allOnWallIds = s.testimonials.map((t) => t.id);
    return {
      id: s.id,
      title: s.title,
      publicSlug: s.publicSlug,
      ratingEnabled: s.ratingEnabled,
      widget: s.widget ? toOwnedWidget(s.widget) : null,
      totalOnWall,
      featured,
      allOnWallIds,
    };
  });
}

/**
 * Shape returned for the "+ Create Wall of Love" modal. We only
 * return spaces the user owns that DO NOT have a widget yet —
 * the unique constraint on `Widget.spaceId` makes a second
 * widget impossible, so the modal has nothing to do if a
 * widget is already attached.
 */
export interface OwnableSpace {
  id: string;
  title: string;
  publicSlug: string;
  ratingEnabled: boolean;
}

/**
 * List every owned space that does NOT yet have a widget.
 * The manager page hands this list to `CreateWidgetModal` so
 * the dropdown only shows valid targets.
 */
export async function listOwnableSpacesWithoutWidget(
  userId: string,
): Promise<OwnableSpace[]> {
  const rows = await prisma.space.findMany({
    where: {
      ownerId: userId,
      widget: { is: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      ratingEnabled: true,
    },
  });
  return rows;
}

/**
 * Look up a widget by its public `widgetId` and verify ownership.
 * Returns `null` when the widget does not exist or is owned by a
 * different user.
 */
export async function getOwnedWidget(userId: string, widgetId: string) {
  const row = await prisma.widget.findFirst({
    where: {
      widgetId,
      space: { ownerId: userId },
    },
    select: {
      id: true,
      spaceId: true,
      widgetId: true,
      theme: true,
      layout: true,
      scrollDirection: true,
      showHeart: true,
      hideDate: true,
      hideSource: true,
      space: { select: { publicSlug: true } },
    },
  });
  if (!row) return null;
  return { ...row, layout: pickLayout(row.layout) };
}

/**
 * Lazy-create a widget for a space the user owns. The route handler
 * has already verified the space belongs to the user; this function
 * just makes sure we don't violate the unique constraint and that
 * the new `widgetId` is unique.
 *
 * The optional `initialConfig` lets the create flow pre-populate
 * the layout / theme / toggles in one round-trip; the public
 * wall page can then render the right shape immediately.
 */
export async function createWidgetForSpace(
  userId: string,
  spaceId: string,
  initialConfig?: Partial<WidgetInput>,
) {
  const space = await prisma.space.findFirst({
    where: { id: spaceId, ownerId: userId },
    select: { id: true },
  });
  if (!space) {
    throw new SpaceNotFoundError();
  }
  const existing = await prisma.widget.findUnique({
    where: { spaceId },
    select: { id: true },
  });
  if (existing) {
    throw new WidgetAlreadyExistsError();
  }
  const widgetId = await ensureUniqueWidgetId();
  const row = await prisma.widget.create({
    data: {
      spaceId: space.id,
      widgetId,
      ...(initialConfig?.layout ? { layout: initialConfig.layout } : {}),
      ...(initialConfig?.theme ? { theme: initialConfig.theme } : {}),
      ...(initialConfig?.scrollDirection
        ? { scrollDirection: initialConfig.scrollDirection }
        : {}),
      ...(typeof initialConfig?.showHeart === "boolean"
        ? { showHeart: initialConfig.showHeart }
        : {}),
      ...(typeof initialConfig?.hideDate === "boolean"
        ? { hideDate: initialConfig.hideDate }
        : {}),
      ...(typeof initialConfig?.hideSource === "boolean"
        ? { hideSource: initialConfig.hideSource }
        : {}),
    },
    select: widgetSelect,
  });
  return toOwnedWidget(row);
}

/**
 * Update a widget's config. The route handler has already validated
 * the body. Throws `WidgetNotFoundError` when the widget does not
 * exist or is owned by a different user.
 */
export async function updateWidget(
  userId: string,
  widgetId: string,
  input: WidgetInput,
) {
  const existing = await prisma.widget.findFirst({
    where: { widgetId, space: { ownerId: userId } },
    select: { id: true },
  });
  if (!existing) {
    throw new WidgetNotFoundError();
  }
  const row = await prisma.widget.update({
    where: { id: existing.id },
    data: {
      theme: input.theme,
      layout: input.layout,
      scrollDirection: input.scrollDirection,
      showHeart: input.showHeart,
      hideDate: input.hideDate,
      hideSource: input.hideSource,
    },
    select: widgetSelect,
  });
  return toOwnedWidget(row);
}

/**
 * Hard-delete a widget. The route handler has verified ownership.
 * Throws `WidgetNotFoundError` when the widget does not exist or
 * is owned by a different user.
 */
export async function deleteWidget(userId: string, widgetId: string): Promise<void> {
  const existing = await prisma.widget.findFirst({
    where: { widgetId, space: { ownerId: userId } },
    select: { id: true },
  });
  if (!existing) {
    throw new WidgetNotFoundError();
  }
  await prisma.widget.delete({ where: { id: existing.id } });
}
