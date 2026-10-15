"use client";

/**
 * Carousel / Slider wall renderer.
 *
 * Horizontal snap-scroll using `overflow-x: auto` and CSS
 * `scroll-snap`. One card per panel on mobile, two on small
 * tablets, three on wider screens — the breakpoints mirror the
 * masonry columns so the carousel feels like a companion
 * layout rather than a different product.
 *
 * Subtle keyboard + drag affordances:
 *   - Buttons on either side scroll the track by one viewport
 *     width per click — `scrollBy({ left: ±100%, behavior:
 *     'smooth' })`.
 *   - The scroll position is reflected on the buttons' disabled
 *     state so the "Prev" button disables at the start and
 *     "Next" disables at the end.
 *   - `scroll-snap-type: x mandatory` on the track + `scroll-
 *     snap-align: start` on each card gives the per-card
 *     bounce snap.
 *
 * `prefers-reduced-motion: reduce` keeps the snap behavior but
 * removes the smooth scroll so users who opt out of motion
 * jump straight to the target card.
 */

import { useEffect, useRef, useState } from "react";
import {
  WallTestimonialCard,
  type WallTestimonialItem,
} from "@/components/wall-of-love/WallTestimonialCard";

interface CarouselWallProps {
  items: WallTestimonialItem[];
  ratingEnabled: boolean;
  theme: "light" | "dark";
  hideDate: boolean;
  hideSource: boolean;
  showHeart: boolean;
}

export function CarouselWall({
  items,
  ratingEnabled,
  theme,
  hideDate,
  // `hideSource` is reserved for a future per-card source-icon
  // affordance; the carousel omits source icons today, so we
  // accept the prop for API symmetry but don't read it.
  hideSource: _hideSource,
  showHeart,
}: CarouselWallProps) {
  const isDark = theme === "dark";
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Track the current scroll position so the prev/next buttons
  // can disable themselves at the boundaries.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setAtStart(el.scrollLeft <= 4);
      setAtEnd(el.scrollLeft >= max - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length]);

  function scrollByPages(direction: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  }

  if (items.length === 0) {
    return (
      <p
        className={
          isDark
            ? "rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400"
            : "rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500"
        }
      >
        No testimonials on this wall yet.
      </p>
    );
  }

  return (
    <div
      className="carousel-wall relative"
      data-show-heart={showHeart ? "1" : "0"}
    >
      <div
        ref={trackRef}
        className="carousel-wall__track"
        role="region"
        aria-label="Testimonial carousel"
      >
        {items.map((item) => (
          <div key={item.id} className="carousel-wall__card">
            <WallTestimonialCard
              item={item}
              ratingEnabled={ratingEnabled}
              theme={theme}
              hideDate={hideDate}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollByPages(-1)}
        disabled={atStart}
        aria-label="Previous testimonial"
        className="carousel-wall__btn carousel-wall__btn--prev"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => scrollByPages(1)}
        disabled={atEnd}
        aria-label="Next testimonial"
        className="carousel-wall__btn carousel-wall__btn--next"
      >
        ›
      </button>

      <style>{`
        .carousel-wall__track {
          display: flex;
          gap: 1rem;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding: 0.25rem 0.25rem 0.75rem;
          scrollbar-width: thin;
        }
        .carousel-wall__card {
          flex: 0 0 100%;
          scroll-snap-align: start;
        }
        @media (min-width: 640px) {
          .carousel-wall__card { flex-basis: calc((100% - 1rem) / 2); }
        }
        @media (min-width: 1024px) {
          .carousel-wall__card { flex-basis: calc((100% - 2rem) / 3); }
        }
        .carousel-wall__btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          font-size: 22px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.92);
          color: #18181b;
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
          cursor: pointer;
          transition: opacity 120ms;
        }
        .carousel-wall__btn:disabled { opacity: 0.4; cursor: default; }
        .carousel-wall__btn--prev { left: 0.5rem; }
        .carousel-wall__btn--next { right: 0.5rem; }
        @media (prefers-reduced-motion: reduce) {
          .carousel-wall__track { scroll-behavior: auto; }
        }
      `}</style>
    </div>
  );
}
