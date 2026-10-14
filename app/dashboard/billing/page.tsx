import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, isPremium } from "@/lib/plan-limits";
import { BillingClient } from "@/components/billing/BillingClient";
import { PaymentResultBanner } from "@/components/billing/PaymentResultBanner";

/**
 * /dashboard/billing
 *
 * Per PRD section 3.8 this page shows the current plan, usage vs the
 * plan's limits, and an Upgrade button. The actual plan change only
 * happens via a verified Stripe webhook — never on a redirect.
 *
 * Auth: the project doesn't have authentication wired up yet, so
 * for now we identify the user via a `?userId=<id>` query string.
 * When auth lands this should be replaced with a server-side
 * `getCurrentUser()` call. Marked with TODO.
 */

type SearchParams = Promise<{ userId?: string; payment?: string }>;

export default async function BillingPage(props: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingInner searchParams={props.searchParams} />
    </Suspense>
  );
}

async function BillingInner({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId, payment } = await searchParams;

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-4 text-zinc-600">
          You must be signed in to view billing.{" "}
          <Link href="/" className="text-blue-600 underline">
            Go home
          </Link>
        </p>
      </main>
    );
  }

  // Load the user, their subscription, and current usage counts in a
  // single round-trip where possible.
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

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-4 text-zinc-600">User not found.</p>
      </main>
    );
  }

  // Count testimonials across all of the user's spaces. Group by
  // space so we can highlight any space that's near the per-space
  // limit.
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 underline-offset-4 hover:underline"
        >
          Back to dashboard
        </Link>
      </header>

      <PaymentResultBanner status={payment} premium={premium} />

      <section
        aria-labelledby="current-plan"
        className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h2
          id="current-plan"
          className="text-lg font-semibold text-zinc-900"
        >
          Current plan
        </h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight">
          {premium ? "Premium" : "Free"}
        </p>
        {user.subscriptions?.[0]?.currentBillingPeriod ? (
          <p className="mt-1 text-sm text-zinc-600">
            Renews on{" "}
            {user.subscriptions[0].currentBillingPeriod.toLocaleDateString()}
          </p>
        ) : null}
        {user.subscriptions?.[0]?.status &&
        user.subscriptions[0].status !== "active" &&
        !premium ? (
          <p className="mt-2 text-sm text-amber-700">
            Subscription status: {user.subscriptions[0].status}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="usage"
        className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h2 id="usage" className="text-lg font-semibold text-zinc-900">
          Usage
        </h2>
        <dl className="mt-4 space-y-4">
          <UsageRow
            label="Spaces"
            used={spacesUsed}
            max={maxSpace}
          />
          <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-zinc-800">
                Testimonials per space
              </span>
              <span className="text-zinc-600">up to {perSpaceLimit}</span>
            </div>
            <ul className="space-y-1 text-sm text-zinc-600">
              {spaces.length === 0 ? (
                <li className="text-zinc-500">No spaces yet.</li>
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
        className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h2 id="upgrade" className="text-lg font-semibold text-zinc-900">
          {premium ? "Manage subscription" : "Upgrade to Premium"}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          {premium
            ? "You're on the Premium plan. Use the Stripe billing portal to update payment methods or cancel."
            : `Unlock up to ${PLAN_LIMITS.premium.maxSpaces} spaces and ${PLAN_LIMITS.premium.maxTestimonialsPerSpace} testimonials per space.`}
        </p>
        <div className="mt-4">
          <BillingClient
            userId={user.id}
            alreadyPremium={premium}
            hasCustomer={Boolean(user.subscriptions?.[0]?.stripeCustomerId)}
          />
        </div>
      </section>
    </main>
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
        <span className="font-medium text-zinc-800">{label}</span>
        <span className="text-zinc-600">
          {used} / {max}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-zinc-100"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full rounded-full bg-zinc-900 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BillingSkeleton() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 h-8 w-32 animate-pulse rounded bg-zinc-100" />
      <div className="h-32 animate-pulse rounded-2xl bg-zinc-50" />
      <div className="mt-6 h-40 animate-pulse rounded-2xl bg-zinc-50" />
      <div className="mt-6 h-32 animate-pulse rounded-2xl bg-zinc-50" />
    </main>
  );
}
