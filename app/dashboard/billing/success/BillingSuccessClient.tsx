"use client";

/**
 * Tiny client island for the `/dashboard/billing/success` page.
 *
 * - Renders the celebration card (the success/cancelled/neutral
 *   headline + body, plus "Back to Billing" and "Go to Dashboard"
 *   buttons).
 * - If `autoRedirectMs` is set, fires a one-shot `router.replace`
 *   to `/dashboard/billing` after that delay. The redirect target
 *   is the billing page (not the dashboard root) so the user lands
 *   on the screen that actually reflects the change.
 *
 * The auto-redirect is a courtesy; the buttons always work as
 * fallbacks if JS is disabled or the user wants to navigate
 * manually.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Variant = "success" | "cancelled" | "neutral";

export function BillingSuccessClient({
  variant,
  headline,
  body,
  premium,
  autoRedirectMs,
}: {
  variant: Variant;
  headline: string;
  body: string;
  premium: boolean;
  autoRedirectMs: number | null;
}) {
  const router = useRouter();
  // Guard against React 18 strict-mode double-invocation.
  const firedRef = useRef(false);

  useEffect(() => {
    if (autoRedirectMs == null) return;
    if (firedRef.current) return;
    firedRef.current = true;
    const handle = setTimeout(() => {
      router.replace("/dashboard/billing");
    }, autoRedirectMs);
    return () => clearTimeout(handle);
  }, [autoRedirectMs, router]);

  // Variant-specific styling. The success variant pops with a
  // subtle emerald→amber gradient; the cancelled variant uses
  // amber; neutral falls back to zinc.
  const tone =
    variant === "success"
      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 text-emerald-950"
      : variant === "cancelled"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-zinc-200 bg-white text-zinc-900";

  const badgeBg =
    variant === "success"
      ? "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950"
      : variant === "cancelled"
        ? "bg-amber-500 text-white"
        : "bg-zinc-900 text-white";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-10 text-center shadow-sm ${tone}`}
      role="status"
      aria-live="polite"
    >
      <div
        aria-hidden
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full shadow-md bsc-badge-anim ${badgeBg}`}
      >
        {variant === "success" ? (
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        ) : variant === "cancelled" ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <span className="text-2xl leading-none">$</span>
        )}
      </div>

      <h1 className="mt-5 text-3xl font-semibold tracking-tight">{headline}</h1>
      <p className="mt-3 text-sm">{body}</p>

      {variant === "success" && premium ? (
        <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
          <span aria-hidden>★</span> Premium is active
        </p>
      ) : null}

      {variant === "success" && autoRedirectMs != null ? (
        <p className="mt-4 text-xs text-zinc-500">
          Taking you back in a moment…
        </p>
      ) : null}

      <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link
          href="/dashboard/billing"
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Back to Billing
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Go to Dashboard
        </Link>
      </div>

      {/* Scoped keyframes for the success badge. We use a <style>
          tag here because the effect is only relevant to this one
          component. The `prefers-reduced-motion` media query
          collapses the animation to its final frame for users
          who've opted out of motion. */}
      <style>{`
        @keyframes bsc-pop {
          0%   { transform: scale(0);    opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          80%  { transform: scale(0.95); }
          100% { transform: scale(1);    opacity: 1; }
        }
        .bsc-badge-anim { animation: bsc-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .bsc-badge-anim { animation: none; }
        }
      `}</style>
    </div>
  );
}
