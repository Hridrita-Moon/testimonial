/**
 * Widget layout catalog.
 *
 * The DB stores a free-form string on `Widget.layout`; this file
 * is the single source of truth for the valid values, the order
 * they appear in the editor, and the human-friendly metadata the
 * dashboard + create-modal render.
 *
 * Adding a new layout is a two-step change:
 *   1. add a new entry to `WIDGET_LAYOUTS` below,
 *   2. add the corresponding renderer branch in
 *      `components/wall-of-love/LayoutPicker.tsx` (preview
 *      card) and `components/wall-of-love/<Name>Wall.tsx`
 *      (real renderer).
 *
 * The DB column doesn't need a migration because the runtime
 * gracefully falls back to `masonryAnimated` for unknown values
 * via `pickLayout()`.
 */

import type { WidgetLayout } from "@/lib/validation/widget";

export interface WidgetLayoutMeta {
  id: WidgetLayout;
  label: string;
  shortLabel: string;
  description: string;
  /** Tiny inline SVG used by the picker card and the create
   *  modal. 1.5 stroke width keeps it crisp on small cards. */
  iconPath: string;
  /** Hex color used as a faint background for the icon tile in
   *  the picker. */
  accent: string;
}

export const WIDGET_LAYOUTS: readonly WidgetLayoutMeta[] = [
  {
    id: "masonryAnimated",
    label: "Masonry – Animated",
    shortLabel: "Animated",
    description:
      "Vertical flow with a gentle auto-scroll. Pauses when a visitor hovers a card.",
    iconPath:
      "M3 4h6v8H3zM11 4h6v5h-6zM11 11h6v9h-6zM3 14h6v6H3z",
    accent: "#a855f7",
  },
  {
    id: "masonryFixed",
    label: "Masonry – Fixed",
    shortLabel: "Fixed",
    description:
      "A clean static grid. Best for small walls where every testimonial should be readable at a glance.",
    iconPath:
      "M3 3h7v7H3zM12 3h7v7h-7zM3 12h7v7H3zM12 12h7v7h-7z",
    accent: "#3b82f6",
  },
  {
    id: "carousel",
    label: "Carousel / Slider",
    shortLabel: "Carousel",
    description:
      "Horizontal snap-scroll. One card at a time on mobile, two or three on wider screens.",
    iconPath:
      "M2 6h16v10H2zM19 9l3 2-3 2z",
    accent: "#f59e0b",
  },
] as const;

/**
 * Resolve an arbitrary stored value (e.g. a URL query string or a
 * DB row) to one of the three known layouts. Anything unknown
 * falls back to `masonryAnimated` so the wall still renders.
 */
export function pickLayout(value: string | null | undefined): WidgetLayout {
  if (
    value === "masonryAnimated" ||
    value === "masonryFixed" ||
    value === "carousel"
  ) {
    return value;
  }
  return "masonryAnimated";
}

/** Friendly label for a layout, e.g. for tooltips. */
export function layoutLabel(value: string | null | undefined): string {
  const id = pickLayout(value);
  return WIDGET_LAYOUTS.find((l) => l.id === id)?.label ?? "Masonry – Animated";
}
