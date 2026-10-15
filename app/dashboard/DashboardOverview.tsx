import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPremium, getLimitsForPlan } from "@/lib/plan-limits";

/**
 * Dynamic inner of `/dashboard/page.tsx`.
 *
 * Runs inside a `<Suspense>` boundary owned by the page. The page
 * renders a static shell (the page title and `+ New space` CTA) in
 * the initial response; this component streams in once the
 * session + DB reads resolve.
 *
 * The split lets Next 16's cacheComponents pipeline identify a
 * concrete static shell for the page (the heading + button) and
 * cache the segment, instead of dropping the whole page from the
 * instant-UI cache because the top-level `await auth()` was
 * parking the entire render in an implicit Suspense with no
 * fallback.
 *
 * All data is scoped by `ownerId = session.user.id` so other
 * users' rows never appear.
 */
export async function DashboardOverview() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  const userId = session.user.id;

  const [user, spaces, recentTestimonials, totalTestimonials, ratedAgg] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          subscriptions: { select: { plan: true, status: true } },
          _count: { select: { spaces: true } },
        },
      }),
      prisma.space.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          title: true,
          ratingEnabled: true,
          _count: { select: { testimonials: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.testimonial.findMany({
        where: { space: { ownerId: userId } },
        select: {
          id: true,
          contributorName: true,
          testimonialText: true,
          rating: true,
          submissionTimestamp: true,
          visibilityStatus: true,
          space: { select: { id: true, title: true, ratingEnabled: true } },
        },
        orderBy: { submissionTimestamp: "desc" },
        take: 10,
      }),
      prisma.testimonial.count({ where: { space: { ownerId: userId } } }),
      prisma.testimonial.aggregate({
        where: {
          space: { ownerId: userId },
          rating: { not: null },
        },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

  if (!user) {
    return null;
  }

  const plan = isPremium(user.subscriptions?.[0]?.plan) ? "premium" : "free";
  const limits = getLimitsForPlan(plan);
  const spacesUsed = user._count.spaces;
  const anyRatingEnabled = spaces.some((s) => s.ratingEnabled);
  const averageRating =
    anyRatingEnabled && ratedAgg._avg.rating
      ? Number(ratedAgg._avg.rating.toFixed(2))
      : null;
  const ratedCount = ratedAgg._count.rating;

  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Plan"
          value={plan === "premium" ? "Premium" : "Free"}
          hint={`Up to ${limits.maxSpaces} spaces`}
        />
        <Stat
          label="Spaces"
          value={`${spacesUsed} / ${limits.maxSpaces}`}
          hint={
            spacesUsed >= limits.maxSpaces
              ? "At the plan limit"
              : `${limits.maxSpaces - spacesUsed} available`
          }
        />
        <Stat
          label="Testimonials"
          value={String(totalTestimonials)}
          hint={`Up to ${limits.maxTestimonialsPerSpace} per space`}
        />
        <Stat
          label="Avg. rating"
          value={averageRating === null ? "N/A" : `${averageRating} ★`}
          hint={
            averageRating === null
              ? "No rated testimonials yet"
              : `From ${ratedCount} rated ${ratedCount === 1 ? "row" : "rows"}`
          }
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickLink
          href="/dashboard/spaces"
          title="Spaces"
          body={
            spaces.length === 0
              ? "Create your first testimonial space."
              : `You have ${spaces.length} ${spaces.length === 1 ? "space" : "spaces"}.`
          }
        />
        <QuickLink
          href="/dashboard/inbox"
          title="Inbox"
          body={
            totalTestimonials === 0
              ? "No testimonials yet."
              : `Review the ${totalTestimonials} you've received.`
          }
        />
        <QuickLink
          href="/dashboard/billing"
          title="Billing"
          body={
            plan === "premium"
              ? "Manage your Premium subscription."
              : "Upgrade for more spaces and testimonials."
          }
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Recent activity
        </h2>
        {recentTestimonials.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            When a contributor submits a testimonial, it will appear
            here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {recentTestimonials.map((t) => (
              <li key={t.id} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t.contributorName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t.space.title} ·{" "}
                    {t.submissionTimestamp.toLocaleDateString()}
                  </p>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {t.testimonialText}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                  {t.rating != null && t.space.ratingEnabled ? (
                    <span>{t.rating} ★</span>
                  ) : null}
                  {t.visibilityStatus === "hidden" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                      Hidden
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <a
      href={href}
      className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
    >
      <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {title} →
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </a>
  );
}
