import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPremium, getLimitsForPlan } from "@/lib/plan-limits";

/**
 * Dynamic inner of `/dashboard/settings/page.tsx`.
 *
 * Stub page. Shows the user's name, email, current plan, and
 * plan limits, plus a "Manage billing" link. We don't yet expose
 * name / email / password change forms — those need additional
 * validation surfaces and are tracked as follow-up work.
 *
 * Runs inside a `<Suspense>` boundary owned by the page. The
 * static shell (the "Settings" heading + subhead) renders in
 * the initial response; this content streams in once the
 * session + DB reads resolve.
 *
 * The proxy already gates this path behind an authenticated
 * session; the explicit `auth()` call below is
 * belt-and-braces.
 */
export async function SettingsContent() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      subscriptions: {
        select: { plan: true, status: true, currentBillingPeriod: true },
      },
    },
  });
  if (!user) return null;

  const plan = isPremium(user.subscriptions?.[0]?.plan) ? "premium" : "free";
  const limits = getLimitsForPlan(plan);

  return (
    <>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
          Account
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Field label="Name" value={user.name ?? "—"} />
          <Field label="Email" value={user.email} />
          <Field
            label="Member since"
            value={user.createdAt.toLocaleDateString()}
          />
        </dl>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Editing your name or email is not yet available in the dashboard.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
            Plan
          </h2>
          <span
            className={
              plan === "premium"
                ? "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                : "inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }
          >
            {plan === "premium" ? "Premium" : "Free"}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Max spaces" value={String(limits.maxSpaces)} />
          <Field
            label="Max testimonials / space"
            value={String(limits.maxTestimonialsPerSpace)}
          />
          <Field
            label="Status"
            value={user.subscriptions?.[0]?.status ?? "—"}
          />
          <Field
            label="Renews on"
            value={
              user.subscriptions?.[0]?.currentBillingPeriod
                ? new Date(
                    user.subscriptions[0].currentBillingPeriod,
                  ).toLocaleDateString()
                : "—"
            }
          />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/dashboard/billing"
            className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Manage billing
          </Link>
        </div>
      </section>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
