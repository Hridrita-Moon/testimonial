"use client";

import { useState } from "react";
import { getPremiumPriceDisplay } from "@/lib/plan-limits";

/**
 * Client component for the Billing page's upgrade CTA.
 *
 * Calls POST /api/stripe/checkout and redirects to the returned
 * session URL. We deliberately do NOT do anything on the success
 * page that would imply a plan upgrade — the webhook is the only
 * place a plan is changed.
 */
export function BillingClient({
  userId,
  alreadyPremium,
  hasCustomer,
}: {
  userId: string;
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
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        throw new Error("Checkout session did not return a URL");
      }
      window.location.href = data.url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  if (alreadyPremium) {
    return (
      <p className="text-sm text-zinc-600">
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
        className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirecting…" : `Upgrade to Premium — ${getPremiumPriceDisplay()}`}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {hasCustomer ? null : (
        <p className="text-xs text-zinc-500">
          You&apos;ll be redirected to Stripe to complete checkout. Your plan
          will activate after payment is confirmed.
        </p>
      )}
    </div>
  );
}
