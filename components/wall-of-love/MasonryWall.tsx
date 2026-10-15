"use client";

/**
 * Masonry wall renderer.
 *
 * Two flavors driven by `animated`:
 *
 *   - `animated: true`  →  a single column that auto-scrolls
 *     bottom-to-top or top-to-bottom based on `scrollDirection`.
 *     The animation pauses when the user hovers anywhere over
 *     the wall (per testimonial.to reference behavior). The
 *     keyframe is implemented in CSS so the JS bundle stays
 *     small; pausing on hover is a single `:hover { animation-
 *     play-state: paused }` rule.
 *
 *   - `animated: false` →  a CSS `columns` masonry — a clean
 *     static grid that doesn't move. Browser-native column
 *     distribution handles the layout, so the markup stays
 *     straightforward.
 *
 * In both cases the `WallTestimonialCard` is used per row;
 * the only difference is the outer container and any
 * auto-scroll behavior.
 */

import { useMemo } from "react";
import {
  WallTestimonialCard,
  type WallTestimonialItem,
} from "@/components/wall-of-love/WallTestimonialCard";

interface MasonryWallProps {
  items: WallTestimonialItem[];
  ratingEnabled: boolean;
  theme: "light" | "dark";
  hideDate: boolean;
  hideSource: boolean;
  showHeart: boolean;
  /** When true, the column auto-scrolls. */
  animated: boolean;
  /** `up` = bottom-to-top (the testimonial.to default).
   *  Ignored when `animated` is false. */
  scrollDirection: "up" | "down";
}

export function MasonryWall({
  items,
  ratingEnabled,
  theme,
  hideDate,
  hideSource: _hideSource,
  showHeart,
  animated,
  scrollDirection,
}: MasonryWallProps) {
  const isDark = theme === "dark";

  // Doubling the list is a cheap way to get a smooth loop on
  // the animated flavor. We avoid that for `animated: false`
  // because a static grid shouldn't have duplicate entries.
  const rendered = useMemo(() => {
    if (!animated) return items;
    if (items.length === 0) return items;
    // Aim for ~16 items so the scroll visibly continues even
    // when the wall is short. The original items render first,
    // then a second copy slides up behind them.
    return [...items, ...items].slice(0, Math.max(items.length, 16));
  }, [items, animated]);

  if (items.length === 0) {
    return (
      <p
        className={
          isDark
            ? "rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400 transition-all duration-200"
            : "rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 transition-all duration-200"
        }
      >
        No testimonials on this wall yet.
      </p>
    );
  }

  if (!animated) {
    return (
      <ul
        className="masonry-static"
        style={{
          columnGap: "1rem",
        }}
      >
        {rendered.map((item, i) => (
          <li
            key={`${item.id}-${i}`}
            className="mb-4 break-inside-avoid"
            style={{ listStyle: "none" }}
          >
            <WallTestimonialCard
              item={item}
              ratingEnabled={ratingEnabled}
              theme={theme}
              hideDate={hideDate}
            />
          </li>
        ))}
        <style>{`
          .masonry-static {
            column-count: 1;
          }
          @media (min-width: 640px) { .masonry-static { column-count: 2; } }
          @media (min-width: 1024px) { .masonry-static { column-count: 3; } }
        `}</style>
      </ul>
    );
  }

  return (
    <div
      className="masonry-animated relative overflow-hidden"
      data-scroll-direction={scrollDirection}
      data-show-heart={showHeart ? "1" : "0"}
      style={{ maxHeight: "640px" }}
    >
      <div className="masonry-animated__track" data-direction={scrollDirection}>
        {rendered.map((item, i) => (
          <div key={`${item.id}-${i}`} className="masonry-animated__item">
            <WallTestimonialCard
              item={item}
              ratingEnabled={ratingEnabled}
              theme={theme}
              hideDate={hideDate}
            />
          </div>
        ))}
      </div>
      {/* Top + bottom fade so the looped items don't pop in
          abruptly. The mask-image fades to transparent on
          both edges. */}
      <style>{`
        .masonry-animated {
          mask-image: linear-gradient(
            to bottom,
            transparent 0,
            black 8%,
            black 92%,
            transparent 100%
          );
        }
        .masonry-animated__track {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          will-change: transform;
          animation: masonry-animated-scroll 40s linear infinite;
        }
        .masonry-animated__track[data-direction="down"] {
          animation-direction: reverse;
        }
        .masonry-animated:hover .masonry-animated__track {
          animation-play-state: paused;
        }
        @keyframes masonry-animated-scroll {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(0, -50%, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .masonry-animated__track { animation: none; }
        }
      `}</style>
    </div>
  );
}
