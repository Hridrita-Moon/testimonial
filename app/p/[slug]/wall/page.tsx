import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { WallRenderer } from "@/components/wall-of-love/WallRenderer";
import { pickLayout } from "@/lib/widget-layouts";
import type { WallTestimonialItem } from "@/components/wall-of-love/WallTestimonialCard";

/**
 * Public per-space Wall of Love at `/p/<slug>/wall`.
 *
 * Resolves the space by `publicSlug` (404 on miss), then loads
 * every testimonial where `isWallOfLove = true AND
 * visibilityStatus = 'published'`, ordered `isFavorite DESC,
 * submissionTimestamp DESC` — the locked data-model spec query.
 *
 * The contributor's email is never returned. The contributor's
 * `socialLinks` and `profilePhoto` are also not rendered in MVP
 * (they live in the schema but exposing URLs on the public
 * surface needs a sanitization step that is out of scope for this
 * change; the data is still in the DB and rendered in the
 * owner's inbox).
 *
 * The rating is rendered only when `Space.ratingEnabled = true`.
 *
 * No auth required: this page is the public surface, served to
 * anyone with the slug. The card markup is shared with the
 * owner-only dashboard preview at `/dashboard/wall-of-love` (the
 * dashboard manager also embeds this URL in an `<iframe>` for
 * its live preview; query-string overrides `theme`, `hideDate`,
 * `hideSource`, `showHeart`, `layout`, and `scrollDirection` are
 * honored when present so the iframe reflects the open drawer's
 * unsaved state).
 */

// Per-slug DB lookup drives the whole page. No static shell
// worth prefetching, so opt out of instant-navigation validation.
export const instant = false;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}

function firstString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function PublicWallPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const space = await prisma.space.findUnique({
    where: { publicSlug: slug },
    select: {
      id: true,
      title: true,
      subtitle: true,
      ratingEnabled: true,
      theme: true,
      widget: {
        select: {
          theme: true,
          layout: true,
          scrollDirection: true,
          showHeart: true,
          hideDate: true,
          hideSource: true,
        },
      },
    },
  });
  if (!space) notFound();

  const testimonials = await prisma.testimonial.findMany({
    where: {
      spaceId: space.id,
      isWallOfLove: true,
      visibilityStatus: "published",
    },
    select: {
      id: true,
      contributorName: true,
      testimonialText: true,
      rating: true,
      additionalValues: true,
      isFavorite: true,
      submissionTimestamp: true,
    },
    orderBy: [{ isFavorite: "desc" }, { submissionTimestamp: "desc" }],
  });

  // Query-string overrides are used by the dashboard manager's
  // iframe live preview to render the wall in different states
  // without persisting anything. Visitors who land on the page
  // directly (no overrides) see the spec'd behavior, identical
  // to before this change.
  const widget = space.widget;
  const themeOverride = firstString(sp.theme);
  const effectiveTheme = themeOverride === "dark" ? "dark" : widget?.theme === "dark" ? "dark" : "light";
  const isDark = effectiveTheme === "dark";
  const layoutOverride = firstString(sp.layout);
  const effectiveLayout = pickLayout(layoutOverride ?? widget?.layout ?? null);
  const hideDate = firstString(sp.hideDate) === "1" || Boolean(widget?.hideDate);
  const hideSource = firstString(sp.hideSource) === "1" || Boolean(widget?.hideSource);
  const showHeart = firstString(sp.showHeart) === "0" ? false : Boolean(widget?.showHeart ?? true);
  const scrollDirection = firstString(sp.scrollDirection) === "down" ? "down" : widget?.scrollDirection === "down" ? "down" : "up";

  const wrapperClass = isDark
    ? "min-h-screen bg-zinc-950 text-zinc-100"
    : "min-h-screen bg-zinc-50 text-zinc-900";

  const items: WallTestimonialItem[] = testimonials.map((t) => ({
    id: t.id,
    contributorName: t.contributorName,
    testimonialText: t.testimonialText,
    rating: t.rating,
    additionalValues: t.additionalValues,
    isFavorite: t.isFavorite,
    submissionTimestamp: t.submissionTimestamp.toISOString(),
  }));

  return (
    <main className={wrapperClass} data-theme={effectiveTheme} data-layout={effectiveLayout} data-scroll-direction={scrollDirection}>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Wall of Love
          </h1>
          <p className="mt-2 text-base font-medium text-zinc-700 dark:text-zinc-300">
            {space.title}
          </p>
          {space.subtitle ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {space.subtitle}
            </p>
          ) : null}
          <p className="mt-4 text-sm">
            <Link
              href={`/p/${slug}`}
              className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
            >
              ← Leave a testimonial
            </Link>
          </p>
        </header>

        <WallRenderer
          items={items}
          layout={effectiveLayout}
          theme={effectiveTheme === "dark" ? "dark" : "light"}
          showHeart={showHeart}
          ratingEnabled={space.ratingEnabled}
          hideDate={hideDate}
          hideSource={hideSource}
          scrollDirection={scrollDirection}
        />
      </div>
    </main>
  );
}
