/**
 * Shows a success/cancelled message based on the `?payment=` query
 * param. This is a UI hint only — it MUST NOT change the user's
 * plan. The webhook (or the mock-upgrade endpoint) is the only
 * place the plan is updated.
 *
 * Three states are recognized:
 *   - `success`  →  real Stripe Checkout finished; the webhook
 *     will upgrade the user. We surface this as a soft
 *     "processing" message because we cannot be sure the webhook
 *     has landed yet.
 *   - `mock`     →  local-dev mock checkout. The user has
 *     already been upgraded server-side, so we can say
 *     "Premium is active" outright.
 *   - `cancelled` →  user clicked Cancel on Stripe. Neutral
 *     "no charge was made" copy.
 *
 * Anything else renders nothing — the Billing UI's normal
 * "Current plan" card is the source of truth.
 */
export function PaymentResultBanner({
  status,
  premium,
}: {
  status: string | undefined;
  premium: boolean;
}) {
  if (status === "success") {
    return (
      <div
        role="status"
        className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        {premium
          ? "Payment confirmed and Premium is active. Thank you!"
          : "Thanks! Your payment is being processed. Premium will activate as soon as Stripe confirms it (usually within a few seconds)."}
      </div>
    );
  }
  if (status === "mock") {
    return (
      <div
        role="status"
        className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <p>
          <span className="font-semibold">Test mode upgrade complete.</span>{" "}
          Stripe isn&apos;t configured in this environment, so we ran a mock
          checkout to flip your account to Premium. Your plan and limits
          are now updated.
        </p>
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
          No real card was charged. Set <code>STRIPE_SECRET_KEY</code> and
          <code> STRIPE_PREMIUM_PRICE_ID</code> in <code>.env</code> to use
          the real Stripe Checkout flow.
        </p>
      </div>
    );
  }
  if (status === "cancelled") {
    return (
      <div
        role="status"
        className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
      >
        Checkout was cancelled. You haven&apos;t been charged.
      </div>
    );
  }
  return null;
}
