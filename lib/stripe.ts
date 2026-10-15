import Stripe from "stripe";

/**
 * Singleton Stripe SDK client.
 *
 * We pin the API version explicitly so a future SDK upgrade doesn't
 * silently change webhook payload shapes on production.
 *
 * NOTE: a placeholder API key (`sk_test_placeholder`) is passed to
 * the SDK constructor so importing this module in environments
 * without real Stripe credentials doesn't crash the build. The
 * `isStripeConfigured()` helper below is the single source of
 * truth for "is Stripe usable right now"; route handlers check it
 * before any Stripe API call and fall back to the mock checkout
 * flow when it's false.
 */
const apiKey = process.env.STRIPE_SECRET_KEY;

if (!apiKey && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_SECRET_KEY is required in production");
}

export const stripe: Stripe = new Stripe(apiKey ?? "sk_test_placeholder", {
  // Pin the API version. Update intentionally when you have tested
  // the new version locally against your webhook handlers.
  apiVersion: "2026-09-30.endive",
  typescript: true,
  appInfo: {
    name: "Testimonial SaaS",
    version: "0.1.0",
  },
});

/**
 * `true` only when BOTH the secret key and the Premium price id
 * are configured with non-placeholder values. This is the single
 * source of truth for whether to take the real-Stripe path or the
 * mock-checkout fallback (see `app/api/stripe/checkout/route.ts`).
 *
 * "Placeholder" is defined as the literal `sk_test_REPLACE_ME` /
 * `pk_test_REPLACE_ME` / `price_REPLACE_ME` / `whsec_REPLACE_ME`
 * markers left in `.env.example` after `.env` is copied. Anything
 * else (including a real test key starting with `sk_test_…`) is
 * treated as configured.
 */
export function isStripeConfigured(): boolean {
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!secret || secret === "sk_test_REPLACE_ME") return false;
  if (!priceId || priceId === "price_REPLACE_ME") return false;
  return true;
}

/**
 * Helper to get the Premium price id from env at runtime, throwing a
 * clear error if it's missing rather than letting Stripe reject the
 * request with a less obvious 400.
 *
 * Callers should prefer `isStripeConfigured()` and route to the
 * mock checkout when this would throw.
 */
export function getPremiumPriceId(): string {
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!priceId || priceId === "price_REPLACE_ME") {
    throw new Error(
      "STRIPE_PREMIUM_PRICE_ID is not configured. Set it in your .env file.",
    );
  }
  return priceId;
}

/**
 * Helper to get the app's public base URL, used for Stripe success/
 * cancel redirects. Falls back to a sane localhost default.
 */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "http://localhost:3000"
  );
}
