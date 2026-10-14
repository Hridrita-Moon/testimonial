/**
 * Shows a success/cancelled message based on the `?payment=` query
 * param. This is a UI hint only — it MUST NOT change the user's
 * plan. The webhook is the only place the plan is updated.
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
        className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
      >
        {premium
          ? "Payment confirmed and Premium is active. Thank you!"
          : "Thanks! Your payment is being processed. Premium will activate as soon as Stripe confirms it (usually within a few seconds)."}
      </div>
    );
  }
  if (status === "cancelled") {
    return (
      <div
        role="status"
        className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        Checkout was cancelled. You haven&apos;t been charged.
      </div>
    );
  }
  return null;
}
