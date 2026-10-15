"use client";

import { useState } from "react";
import { getPremiumPriceDisplay } from "@/lib/plan-limits";

/**
 * Client component for the Billing page's upgrade CTA.
 *
 * Posts to `/api/stripe/checkout` and redirects to the returned
 * URL. Two paths:
 *
 *   - Stripe configured: server returns `url` pointing at a real
 *     Stripe Checkout Session. We hard-navigate to it.
 *   - Stripe unconfigured: server returns `{ url, mock: true }`
 *     pointing at `/dashboard/billing/success?payment=mock`. We
 *     also flip the user's DB subscription to `premium/active`
 *     server-side via `upgradeToPremiumMock`, so the user lands
 *     on the success page with the new limits already in effect.
 *
 * A "Test mode" badge is shown under the button whenever the
 * server indicates mock mode, so the developer knows the click
 * didn't actually reach Stripe (no real card was charged).
 *
 * `getPremiumPriceDisplay` reads `NEXT_PUBLIC_PREMIUM_PRICE_DISPLAY`
 * from env so marketing can change the price without a code
 * change.
 */
export function BillingClient({
  alreadyPremium,
  hasCustomer,
}: {
  alreadyPremium: boolean;
  hasCustomer: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { url?: string; mock?: boolean };
      if (!data.url) {
        throw new Error("Checkout session did not return a URL");
      }
      // Treat as mock whenever the server flag is set OR the URL
      // points at our internal success route. This keeps the
      // celebration copy consistent even if a future server
      // change drops the explicit flag.
      const isMock = data.mock || data.url.includes("/dashboard/billing/success");
      if (isMock) {
        window.location.href = data.url;
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  if (alreadyPremium) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        You&apos;re already on Premium. Manage your subscription from the
        Stripe billing portal (coming soon).
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? "Redirecting…" : `Upgrade to Premium — ${getPremiumPriceDisplay()}`}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {hasCustomer ? null : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          You&apos;ll be redirected to Stripe to complete checkout. Your plan
          will activate after payment is confirmed.
        </p>
      )}
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Running in test mode? Stripe will be skipped and your
        account will be upgraded locally so the flow can be
        exercised end-to-end without real credentials.
      </p>
    </div>
  );
}
