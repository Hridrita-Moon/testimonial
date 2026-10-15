import { Suspense } from "react";
import { BillingSuccessContent } from "./BillingSuccessContent";

/**
 * `/dashboard/billing/success` — landing page after Stripe Checkout
 * (real or mock). Reads `?payment=success|success&session_id=…|
 * mock|cancelled`, shows a celebration, and routes the user to the
 * dashboard.
 *
 * Per the project's Stripe contract, the real `payment=success`
 * path does NOT change the user's plan; the webhook does. The
 * page just confirms the redirect was clean and pushes the user
 * back to the billing screen (which will show "Premium active"
 * once the webhook lands).
 *
 * The `payment=mock` path is the local-dev fallback — in that
 * case the subscription row has already been upgraded server-side
 * by `upgradeToPremiumMock`, so this page can declare Premium
 * active immediately.
 *
 * Sync server component. The dynamic inner runs inside
 * `<Suspense>` so the static chrome (heading + main wrapper)
 * renders in the initial response and the search-param-dependent
 * content streams in.
 */
export default function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; session_id?: string }>;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Suspense fallback={<BillingSuccessFallback />}>
        <BillingSuccessContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function BillingSuccessFallback() {
  return (
    <div
      className="rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm"
      aria-hidden
    >
      <div className="mx-auto h-12 w-12 rounded-full bg-zinc-200" />
      <div className="mx-auto mt-4 h-6 w-64 rounded bg-zinc-200" />
      <div className="mx-auto mt-3 h-4 w-48 rounded bg-zinc-200" />
    </div>
  );
}
