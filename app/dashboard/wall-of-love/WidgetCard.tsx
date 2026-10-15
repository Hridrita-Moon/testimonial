"use client";

/**
 * Per-space Wall of Love showcase card.
 *
 * Each card on `/dashboard/wall-of-love` represents one space
 * that has at least one published testimonial currently on the
 * wall. The card surfaces:
 *
 *   - the space title + slug,
 *   - a `<WallRenderer>` mini preview rendered with the same
 *     `theme`, `layout`, `showHeart`, `hideDate`, `hideSource`,
 *     and `scrollDirection` the public wall uses — so the
 *     preview honors whatever the owner saved in the Edit drawer.
 *   - the total wall count,
 *   - a primary "Edit wall" button that opens `EditWidgetDrawer`
 *     for the per-widget visual config,
 *   - a copy-embed button (only when a widget exists),
 *   - a delete-widget button (only when a widget exists).
 *
 * The preview renderer is a small (max-height) live wall — it
 * is NOT an `<iframe>` because we already have the testimonial
 * rows in the props. Rendering the in-app component keeps the
 * preview interactive (hearts float, masonry animates) without
 * an extra round-trip to `/p/<slug>/wall?…`.
 *
 * Spaces WITHOUT a widget still appear if they have wall
 * testimonials. Without a widget, the embed-aware buttons fall
 * away; the "View wall ↗" external link still works because the
 * public page does not require a widget.
 */

import Link from "next/link";
import { WallRenderer } from "@/components/wall-of-love/WallRenderer";
import type { WallTestimonialItem } from "@/components/wall-of-love/WallTestimonialCard";
import { CopyEmbedButton } from "./CopyEmbedButton";
import { DeleteWidgetButton } from "./DeleteWidgetButton";
import type { WidgetConfig } from "./EditWidgetDrawer";
import type { FeaturedTestimonial } from "@/lib/widgets";

export interface WidgetCardSpace {
  id: string;
  title: string;
  publicSlug: string;
  ratingEnabled: boolean;
  widget: WidgetConfig | null;
  totalOnWall: number;
  featured: FeaturedTestimonial[];
  allOnWallIds: string[];
}

function toWallItems(rows: FeaturedTestimonial[]): WallTestimonialItem[] {
  return rows.map((t) => ({
    id: t.id,
    contributorName: t.contributorName,
    testimonialText: t.testimonialText,
    rating: t.rating,
    additionalValues: t.additionalValues,
    isFavorite: t.isFavorite,
    submissionTimestamp: t.submissionTimestamp,
  }));
}

export function WidgetCard({
  space,
  onEdit,
  onCopySuccess,
  onCopyError,
  onDeleteSuccess,
  onDeleteError,
}: {
  space: WidgetCardSpace;
  onEdit: (publicSlug: string, widget: WidgetConfig) => void;
  onCopySuccess: (msg: string) => void;
  onCopyError: (msg: string) => void;
  onDeleteSuccess: (msg: string) => void;
  onDeleteError: (msg: string) => void;
}) {
  const widget = space.widget;
  const theme = widget?.theme ?? "light";
  const layout = widget?.layout ?? "masonryAnimated";
  const showHeart = widget?.showHeart ?? true;
  const hideDate = widget?.hideDate ?? false;
  const hideSource = widget?.hideSource ?? false;
  const scrollDirection = widget?.scrollDirection ?? "up";
  const moreCount = Math.max(0, space.totalOnWall - space.featured.length);
  const previewItems = toWallItems(space.featured);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {space.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            <code className="font-mono">/p/{space.publicSlug}</code>
            {" · "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {space.totalOnWall}
            </span>{" "}
            on the wall
            {widget ? (
              <>
                {" · "}
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  {labelFor(layout)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <span aria-hidden>♥</span>
          Live
        </span>
      </div>

      <div
        className="overflow-hidden rounded-xl"
        style={{ maxHeight: 320 }}
      >
        <WallRenderer
          items={previewItems}
          layout={layout}
          theme={theme}
          showHeart={showHeart}
          ratingEnabled={space.ratingEnabled}
          hideDate={hideDate}
          hideSource={hideSource}
          scrollDirection={scrollDirection}
        />
      </div>

      {moreCount > 0 ? (
        <p className="-mt-1 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          …and <span className="font-semibold text-zinc-700 dark:text-zinc-200">{moreCount}</span> more on{" "}
          <code className="font-mono">/p/{space.publicSlug}/wall</code>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        {widget ? (
          <>
            <button
              type="button"
              onClick={() => onEdit(space.publicSlug, widget)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              Edit wall
            </button>
            <CopyEmbedButton
              publicSlug={space.publicSlug}
              widgetId={widget.widgetId}
              onSuccess={onCopySuccess}
              onError={onCopyError}
            />
            <DeleteWidgetButton
              widgetId={widget.widgetId}
              spaceTitle={space.title}
              onSuccess={onDeleteSuccess}
              onError={onDeleteError}
            />
          </>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            No embed widget yet. Walls work without one — visitors can
            always see{" "}
            <Link
              href={`/p/${space.publicSlug}/wall`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              /p/{space.publicSlug}/wall
            </Link>{" "}
            directly.
          </p>
        )}
        <Link
          href={`/p/${space.publicSlug}/wall`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          View wall ↗
        </Link>
      </div>
    </div>
  );
}

function labelFor(layout: WidgetConfig["layout"]): string {
  switch (layout) {
    case "masonryAnimated":
      return "Masonry · Animated";
    case "masonryFixed":
      return "Masonry · Fixed";
    case "carousel":
      return "Carousel";
  }
}
