"use client";

/**
 * Wall renderer dispatcher.
 *
 * Picks one of the three layout renderers based on `layout`:
 *
 *   - `masonryAnimated` → `MasonryWall` (animated: true)
 *   - `masonryFixed`    → `MasonryWall` (animated: false)
 *   - `carousel`        → `CarouselWall`
 *
 * Shared wrapper applies the theme styles + the floating
 * hearts layer when `showHeart` is on. The hearts render in
 * the wrapper so all three layouts share the same
 * atmospheric effect; per-layout containers can sit on top
 * with their own backgrounds.
 *
 * `hideSource` is passed through to the renderers so they
 * can omit social-icon affordances in the future; today
 * it's a no-op for the card-level render (no icons are
 * drawn in MVP).
 */

import { FloatingHearts } from "@/components/wall-of-love/FloatingHearts";
import { MasonryWall } from "@/components/wall-of-love/MasonryWall";
import { CarouselWall } from "@/components/wall-of-love/CarouselWall";
import { pickLayout } from "@/lib/widget-layouts";
import type { WallTestimonialItem } from "@/components/wall-of-love/WallTestimonialCard";

interface WallRendererProps {
  items: WallTestimonialItem[];
  layout: string | null | undefined;
  theme: "light" | "dark";
  showHeart: boolean;
  ratingEnabled: boolean;
  hideDate: boolean;
  hideSource: boolean;
  scrollDirection: "up" | "down";
}

export function WallRenderer({
  items,
  layout,
  theme,
  showHeart,
  ratingEnabled,
  hideDate,
  hideSource,
  scrollDirection,
}: WallRendererProps) {
  const isDark = theme === "dark";
  const layoutId = pickLayout(layout);

  return (
    <div
      className={
        "wall-renderer relative overflow-hidden rounded-2xl " +
        (isDark
          ? "border border-zinc-800 bg-zinc-950 p-4 shadow-inner"
          : "border border-zinc-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4 shadow-inner")
      }
      data-layout={layoutId}
      data-theme={theme}
    >
      {showHeart ? <FloatingHearts /> : null}

      {layoutId === "carousel" ? (
        <CarouselWall
          items={items}
          ratingEnabled={ratingEnabled}
          theme={theme}
          hideDate={hideDate}
          hideSource={hideSource}
          showHeart={showHeart}
        />
      ) : (
        <MasonryWall
          items={items}
          ratingEnabled={ratingEnabled}
          theme={theme}
          hideDate={hideDate}
          hideSource={hideSource}
          showHeart={showHeart}
          animated={layoutId === "masonryAnimated"}
          scrollDirection={scrollDirection}
        />
      )}
    </div>
  );
}
