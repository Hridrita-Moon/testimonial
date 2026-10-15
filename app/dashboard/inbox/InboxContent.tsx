import { auth } from "@/lib/auth";
import { listInbox } from "@/lib/testimonials";
import { inboxFilterSchema, type InboxFilter } from "@/lib/validation/inbox";
import { prisma } from "@/lib/prisma";
import { InboxList } from "./InboxList";
import { InboxFilters } from "./InboxFilters";

/**
 * Dynamic inner of `/dashboard/inbox/page.tsx`.
 *
 * Runs inside a `<Suspense>` boundary owned by the page. Reads
 * the URL search params (which are inherently dynamic), the
 * session, and the DB; renders the filter bar + the list. The
 * page's static shell (the `<main>` wrapper, the "Inbox"
 * heading) renders in the initial response; this component
 * streams in once the search params + reads resolve.
 *
 * Without this split, the top-level `await searchParams` parks
 * the page inside an implicit Suspense with no fallback, which
 * is the exact pattern Next 16's "instant navigation dropped
 * segment" warning is about.
 *
 * Default filter: no params = "published" + no space + no
 * rating + no date range + no search + no favorite-only.
 * Hidden testimonials are excluded by default; an explicit
 * `?visibility=hidden` surfaces them.
 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function InboxContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  // Coerce the raw searchParams into the shape Zod expects
  // (all values are strings or undefined). Repeated keys are
  // not expected from the filter form; we take the first value.
  const raw = await searchParams;
  const candidate: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") candidate[key] = value;
    else if (Array.isArray(value) && value[0]) candidate[key] = value[0];
  }
  const parsed = inboxFilterSchema.safeParse(candidate);
  // Bad filter params are silently ignored (the filter form is
  // the only producer). We don't want a malformed URL to 500
  // the page; we just render the unfiltered list.
  const filter: InboxFilter = parsed.success
    ? parsed.data
    : { favorite: false };

  const [testimonials, ownedSpaces] = await Promise.all([
    listInbox(userId, filter),
    prisma.space.findMany({
      where: { ownerId: userId },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {testimonials.length === 0
          ? "No testimonials match the current filter."
          : `${testimonials.length} ${testimonials.length === 1 ? "testimonial" : "testimonials"}`}
      </p>

      <InboxFilters spaces={ownedSpaces} current={filter} />

      <div className="mt-6">
        <InboxList
          testimonials={testimonials.map((t) => ({
            id: t.id,
            contributorName: t.contributorName,
            contributorEmail: t.contributorEmail,
            testimonialText: t.testimonialText,
            rating: t.rating,
            additionalValues: t.additionalValues,
            isFavorite: t.isFavorite,
            isWallOfLove: t.isWallOfLove,
            visibilityStatus: t.visibilityStatus,
            submissionTimestamp: t.submissionTimestamp.toISOString(),
            space: {
              id: t.space.id,
              title: t.space.title,
              ratingEnabled: t.space.ratingEnabled,
            },
          }))}
        />
      </div>
    </>
  );
}
