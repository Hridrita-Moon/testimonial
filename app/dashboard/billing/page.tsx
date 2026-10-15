import { Suspense } from "react";
import Link from "next/link";
import { BillingContent } from "./BillingContent";

/**
 * `/dashboard/billing` — synchronous server component shell.
 *
 * The page itself is a static shell: `<main>` wrapper, the
 * "Billing" heading, and a "Back to dashboard" link. The actual
 * plan / usage / upgrade UI lives in `BillingContent`, an async
 * server component that runs inside a `<Suspense>` boundary and
 * streams in once the search params + session + DB reads
 * resolve.
 *
 * This split is what fixes the "instant navigation dropped
 * segment" warning. Without it, the top-level `await
 * searchParams` parks the page inside an implicit Suspense with
 * no fallback, which Next 16's cacheComponents pipeline drops
 * from its instant-UI cache.
 *
 * Per PRD section 3.8 this page shows the current plan, usage
 * vs the plan's limits, and an Upgrade button. The actual plan
 * change only happens via a verified Stripe webhook — never on
 * a redirect.
 */

type SearchParams = Promise<{ payment?: string }>;

export default function BillingPage(props: {
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 underline-offset-4 hover:underline"
        >
          Back to dashboard
        </Link>
      </header>

      <Suspense fallback={<BillingContentFallback />}>
        <BillingContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

function BillingContentFallback() {
  return (
    <>
      <div className="mt-1 h-4 w-64 rounded bg-zinc-200" />
      <div className="mt-6 h-32 rounded-2xl border border-zinc-200 bg-white shadow-sm" />
      <div className="mt-6 h-48 rounded-2xl border border-zinc-200 bg-white shadow-sm" />
      <div className="mt-6 h-32 rounded-2xl border border-zinc-200 bg-white shadow-sm" />
    </>
  );
}
