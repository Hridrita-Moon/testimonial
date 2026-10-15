"use client";

/**
 * Continuous floating-heart animation for the Wall of Love.
 *
 * Renders a fixed-position layer full of small semi-transparent
 * heart glyphs that rise from the bottom of the widget to the
 * top, with a slight horizontal sway and a fade-in/out. No
 * framer-motion dependency — the effect is pure CSS keyframes
 * driven by deterministic per-element animation-delay / -duration
 * values, so:
 *
 *   1. the markup is identical on the server and on the client
 *      (no hydration mismatch from `Math.random()`);
 *   2. the stream restarts cleanly when the user toggles
 *      `showHeart` because the elements are re-mounted with
 *      fresh `key` props;
 *   3. the bundle stays tiny (≈ 0 KB of JS for the animation
 *      itself — the browser handles the rest).
 *
 * `prefers-reduced-motion: reduce` collapses the keyframes to
 * their final state: hearts stay near the bottom and stay
 * transparent, so users who opt out of motion see a static
 * surface (no flicker).
 */

interface FloatingHeartsProps {
  /** Number of hearts in the stream. 14 looks rich without
   *  thrashing the layout on mid-range phones. */
  count?: number;
  /** Optional class on the wrapping layer. */
  className?: string;
}

/**
 * One heart's per-instance parameters. All values are
 * deterministic (no `Math.random()`) so the server-rendered HTML
 * matches the client's first render byte-for-byte.
 *
 * - `leftPct`:  start position 0–100 % of the layer width.
 * - `size`:     px size of the glyph (12–22).
 * - `delay`:    CSS `animation-delay` in ms.
 * - `duration`: CSS `animation-duration` in ms.
 * - `sway`:     px of horizontal drift during the rise.
 * - `opacity`:  peak opacity (0.35–0.75 looks "real", brighter
 *               starts to feel like a pop-up).
 * - `tone`:     foreground color. Soft rose variants.
 */
interface HeartSpec {
  leftPct: number;
  size: number;
  delay: number;
  duration: number;
  sway: number;
  opacity: number;
  tone: string;
}

const HEART_TONES = [
  "#fb7185", // rose-400
  "#f43f5e", // rose-500
  "#e11d48", // rose-600
  "#fda4af", // rose-300
  "#f9a8d4", // pink-300
  "#f472b6", // pink-400
];

const FIXED_HEARTS: HeartSpec[] = [
  { leftPct: 4,  size: 14, delay: 0,    duration: 7600, sway: 18,  opacity: 0.55, tone: HEART_TONES[0] },
  { leftPct: 12, size: 18, delay: 1200, duration: 8400, sway: -22, opacity: 0.65, tone: HEART_TONES[2] },
  { leftPct: 20, size: 12, delay: 2400, duration: 7200, sway: 16,  opacity: 0.45, tone: HEART_TONES[1] },
  { leftPct: 28, size: 20, delay: 400,  duration: 8800, sway: -14, opacity: 0.7,  tone: HEART_TONES[4] },
  { leftPct: 36, size: 16, delay: 3200, duration: 8000, sway: 24,  opacity: 0.55, tone: HEART_TONES[3] },
  { leftPct: 44, size: 14, delay: 1800, duration: 7600, sway: -18, opacity: 0.5,  tone: HEART_TONES[0] },
  { leftPct: 52, size: 22, delay: 800,  duration: 9200, sway: 20,  opacity: 0.6,  tone: HEART_TONES[5] },
  { leftPct: 60, size: 12, delay: 4400, duration: 7400, sway: -20, opacity: 0.45, tone: HEART_TONES[1] },
  { leftPct: 68, size: 18, delay: 2800, duration: 8600, sway: 14,  opacity: 0.65, tone: HEART_TONES[2] },
  { leftPct: 76, size: 16, delay: 1200, duration: 8200, sway: -16, opacity: 0.55, tone: HEART_TONES[4] },
  { leftPct: 84, size: 14, delay: 3600, duration: 7800, sway: 22,  opacity: 0.5,  tone: HEART_TONES[3] },
  { leftPct: 92, size: 20, delay: 600,  duration: 9000, sway: -24, opacity: 0.7,  tone: HEART_TONES[0] },
  { leftPct: 8,  size: 16, delay: 5200, duration: 8200, sway: 12,  opacity: 0.55, tone: HEART_TONES[5] },
  { leftPct: 48, size: 14, delay: 2200, duration: 7800, sway: -10, opacity: 0.5,  tone: HEART_TONES[1] },
];

export function FloatingHearts({ count = 14, className }: FloatingHeartsProps) {
  // Deterministic (no `Math.random`) positions + sizes mean the
  // server and first-paint HTML are byte-for-byte identical, so
  // there's no hydration mismatch to bridge. The hearts render
  // on the server too; the keyframes start at `opacity: 0` so
  // the first paint is a clean empty layer and the glyphs fade
  // in as the animation runs.
  const hearts = FIXED_HEARTS.slice(0, count);
  return (
    <div
      aria-hidden
      className={
        "floating-hearts pointer-events-none absolute inset-0 overflow-hidden " +
        (className ?? "")
      }
    >
      {hearts.map((h, i) => (
        <span
          key={i}
          className="floating-hearts__heart"
          style={{
            left: `${h.leftPct}%`,
            fontSize: `${h.size}px`,
            color: h.tone,
            // The animation reads the custom properties to
            // know how far to sway and how long to last per
            // element.
            ["--fh-sway" as string]: `${h.sway}px`,
            ["--fh-duration" as string]: `${h.duration}ms`,
            ["--fh-delay" as string]: `${h.delay}ms`,
            ["--fh-opacity" as string]: `${h.opacity}`,
          }}
        >
          ♥
        </span>
      ))}

      <style>{`
        .floating-hearts__heart {
          position: absolute;
          bottom: -10%;
          opacity: 0;
          transform: translate3d(0, 0, 0);
          will-change: transform, opacity;
          animation-name: floating-hearts-rise;
          animation-duration: var(--fh-duration, 8000ms);
          animation-delay: var(--fh-delay, 0ms);
          animation-iteration-count: infinite;
          animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        }
        @keyframes floating-hearts-rise {
          0%   { transform: translate3d(0, 0, 0) scale(0.7); opacity: 0; }
          8%   { opacity: var(--fh-opacity, 0.5); }
          25%  { transform: translate3d(calc(var(--fh-sway, 0px) * 0.4), -25vh, 0) scale(0.95); }
          50%  { transform: translate3d(calc(var(--fh-sway, 0px) * 0.8), -55vh, 0) scale(1.05); }
          75%  { transform: translate3d(calc(var(--fh-sway, 0px) * 0.6), -85vh, 0) scale(1); }
          100% { transform: translate3d(0, -120vh, 0) scale(0.9); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-hearts__heart {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
