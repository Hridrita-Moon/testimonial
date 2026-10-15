/**
 * Public form page at `/p/<slug>`.
 *
 * Server component: loads the `Space` and its `SpaceField` config
 * from Prisma, then renders the title, prompt, and a client-side
 * form. We render `notFound()` when the slug does not resolve to
 * any space — this is the 404 path the spec mandates.
 *
 * Note: the form component (`./submit-form.tsx`) is a client
 * component that handles state, validation, and the POST. The
 * server component is responsible for the data fetch and the
 * outer page chrome only.
 */

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SubmitForm } from "./submit-form";

// The whole page is built from a per-slug DB lookup. There is
// no static shell worth prefetching — we either have the space
// or we 404 — so opt out of instant-navigation validation.
export const instant = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicFormPage({ params }: PageProps) {
  const { slug } = await params;
  const space = await prisma.space.findUnique({
    where: { publicSlug: slug },
    select: {
      id: true,
      title: true,
      subtitle: true,
      prompt: true,
      ratingEnabled: true,
      fields: {
        select: {
          fieldType: true,
          label: true,
          enabled: true,
          required: true,
          displayOrder: true,
        },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!space) {
    notFound();
  }

  // Only enabled fields are passed to the client. Disabled fields
  // are not rendered and the server also rejects any value submitted
  // for them. We filter server-side so the form component does not
  // need a separate `enabled` prop.
  const enabledFields = space.fields
    .filter((f) => f.enabled)
    .map((f) => ({
      fieldType: f.fieldType,
      label: f.label,
      required: f.required,
      displayOrder: f.displayOrder,
    }));

  // A second small query: how many testimonials are on the
  // public wall? We render a "View the Wall of Love" link at
  // the bottom of the form when this is > 0, so contributors
  // can see the public page without a separate route discovery.
  const wallOfLoveCount = await prisma.testimonial.count({
    where: {
      spaceId: space.id,
      isWallOfLove: true,
      visibilityStatus: "published",
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {space.title}
        </h1>
        {space.subtitle ? (
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {space.subtitle}
          </p>
        ) : null}
        <p className="mt-4 text-zinc-700 dark:text-zinc-300">
          {space.prompt}
        </p>
      </header>
      <SubmitForm
        slug={slug}
        ratingEnabled={space.ratingEnabled}
        fields={enabledFields}
      />

      {wallOfLoveCount > 0 ? (
        <div className="mt-8 border-t border-zinc-200 pt-6 text-center dark:border-zinc-800">
          <a
            href={`/p/${slug}/wall`}
            className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            View the Wall of Love →
          </a>
        </div>
      ) : null}
    </main>
  );
}