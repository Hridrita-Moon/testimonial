import Stripe from "stripe";

/**
 * Singleton Stripe SDK client.
 *
 * We pin the API version explicitly so a future SDK upgrade doesn't
 * silently change webhook payload shapes on production.
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
 * Helper to get the Premium price id from env at runtime, throwing a
 * clear error if it's missing rather than letting Stripe reject the
 * request with a less obvious 400.
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
