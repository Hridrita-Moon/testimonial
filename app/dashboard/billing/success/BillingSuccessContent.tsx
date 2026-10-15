import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPremium } from "@/lib/plan-limits";
import { BillingSuccessClient } from "./BillingSuccessClient";

/**
 * Dynamic inner of `/dashboard/billing/success/page.tsx`.
 *
 * Reads the `?payment=` search param and the user's current
 * subscription state, then renders a success / cancelled card.
 *
 * Three cases:
 *   - `payment=mock`  →  mock checkout just upgraded the user; show
 *     an "Upgrade complete" celebration and auto-redirect to
 *     `/dashboard/billing` (which now reflects the new limits).
 *   - `payment=success` →  real Stripe checkout finished; show a
 *     "Payment received — Premium will activate once Stripe
 *     confirms" card. The webhook is the source of truth, so the
 *     card deliberately does not claim Premium is already active
 *     even if the DB row already shows it (race is harmless).
 *   - `payment=cancelled` →  user clicked Cancel on Stripe; show
 *     a neutral "No charge was made" card.
 *   - anything else  →  render a generic landing (handy for direct
 *     visits).
 *
 * The auto-redirect lives in a small client island
 * (`BillingSuccessClient`) so the page can stream the static
 * celebration markup before the JS arrives. A 2-second timer is
 * long enough to read the headline, short enough that the user
 * doesn't feel stuck.
 */
type SearchParams = Promise<{
  payment?: string;
  session_id?: string;
}>;

export async function BillingSuccessContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { payment } = await searchParams;
  const session = await auth();
  if (!session?.user) return null;

  // Re-read the subscription so we can drive the celebration's
  // tone from the actual DB state — not the redirect query.
  const sub = await prisma.subscription.findFirst({
    where: { userId: session.user.id },
    select: { plan: true, status: true, currentBillingPeriod: true },
  });
  const premium = isPremium(sub?.plan);
  const isMock = payment === "mock";
  const isSuccess = payment === "success" || isMock;
  const isCancelled = payment === "cancelled";

  // Decide the headline + body copy.
  const headline = isSuccess
    ? isMock
      ? "Mock checkout complete"
      : "Payment received"
    : isCancelled
      ? "Checkout cancelled"
      : "Billing";
  const body = isSuccess
    ? isMock
      ? "Stripe isn't configured in this environment, so we ran a mock checkout to flip your account to Premium. Your plan and limits are now updated."
      : "Thanks! Stripe is processing your payment. Premium will activate as soon as the webhook confirms the subscription (usually a few seconds)."
    : isCancelled
      ? "No charge was made. You can come back and try again whenever you're ready."
      : "Welcome back.";

  const variant = isSuccess ? "success" : isCancelled ? "cancelled" : "neutral";

  return (
    <BillingSuccessClient
      variant={variant}
      headline={headline}
      body={body}
      premium={premium}
      autoRedirectMs={isSuccess ? 2000 : null}
    />
  );
}
