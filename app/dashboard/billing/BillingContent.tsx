import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, isPremium } from "@/lib/plan-limits";
import { BillingClient } from "@/components/billing/BillingClient";
import { PaymentResultBanner } from "@/components/billing/PaymentResultBanner";

/**
 * Dynamic inner of `/dashboard/billing/page.tsx`.
 *
 * Per PRD section 3.8 this page shows the current plan, usage
 * vs the plan's limits, and an Upgrade button. The actual plan
 * change only happens via a verified Stripe webhook — never on
 * a redirect.
 *
 * Runs inside a `<Suspense>` boundary owned by the page. The
 * static shell (the `<main>` wrapper + the "Billing" heading +
 * "Back to dashboard" link) renders in the initial response;
 * this content streams in once the search params + session + DB
 * reads resolve.
 *
 * Auth: the page is session-gated. The proxy at `/dashboard/*`
 * redirects unauthenticated visitors to `/sign-in?next=...`;
 * this component additionally short-circuits to `null` if a
 * stray request slips through (e.g. with a stale cookie). The
 * session `user.id` is the only source of "who is this" — the
 * previous `?userId=` shim is gone.
 */

type SearchParams = Promise<{ payment?: string }>;

export async function BillingContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { payment } = await searchParams;
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  // Load the user, their subscription, and current usage
  // counts in a single round-trip where possible.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      subscriptions: {
        select: {
          plan: true,
          status: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          currentBillingPeriod: true,
        },
      },
      _count: {
        select: { spaces: true },
      },
    },
  });

  if (!user) return null;

  // Count testimonials across all of the user's spaces. Group
  // by space so we can highlight any space that's near the
  // per-space limit.
  const spaces = await prisma.space.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      title: true,
      _count: { select: { testimonials: true } },
    },
  });

  const plan = user.subscriptions?.[0]?.plan ?? "free";
  const premium = isPremium(plan);
  const limits = premium ? PLAN_LIMITS.premium : PLAN_LIMITS.free;

  const spacesUsed = user._count.spaces;
  const maxSpace = limits.maxSpaces;
  const perSpaceLimit = limits.maxTestimonialsPerSpace;

  return (
    <>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as <span className="font-medium text-zinc-800 dark:text-zinc-200">{user.email}</span>
      </p>

      <PaymentResultBanner status={payment} premium={premium} />

      <section
        aria-labelledby="current-plan"
        className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2
          id="current-plan"
          className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
        >
          Current plan
        </h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {premium ? "Premium" : "Free"}
        </p>
        {user.subscriptions?.[0]?.currentBillingPeriod ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Renews on{" "}
            {user.subscriptions[0].currentBillingPeriod.toLocaleDateString()}
          </p>
        ) : null}
        {user.subscriptions?.[0]?.status &&
        user.subscriptions[0].status !== "active" &&
        !premium ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            Subscription status: {user.subscriptions[0].status}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="usage"
        className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 id="usage" className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Usage
        </h2>
        <dl className="mt-4 space-y-4">
          <UsageRow label="Spaces" used={spacesUsed} max={maxSpace} />
          <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Testimonials per space
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">up to {perSpaceLimit}</span>
            </div>
            <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {spaces.length === 0 ? (
                <li className="text-zinc-500 dark:text-zinc-500">No spaces yet.</li>
              ) : (
                spaces.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{s.title}</span>
                    <span>
                      {s._count.testimonials} / {perSpaceLimit}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="upgrade"
        className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 id="upgrade" className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {premium ? "Manage subscription" : "Upgrade to Premium"}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {premium
            ? "You're on the Premium plan. Use the Stripe billing portal to update payment methods or cancel."
            : `Unlock up to ${PLAN_LIMITS.premium.maxSpaces} spaces and ${PLAN_LIMITS.premium.maxTestimonialsPerSpace} testimonials per space.`}
        </p>
        <div className="mt-4">
          <BillingClient
            alreadyPremium={premium}
            hasCustomer={Boolean(user.subscriptions?.[0]?.stripeCustomerId)}
          />
        </div>
      </section>
    </>
  );
}

function UsageRow({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number;
}) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
        <span className="text-zinc-600 dark:text-zinc-400">
          {used} / {max}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full rounded-full bg-zinc-900 transition-all duration-500 dark:bg-zinc-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
