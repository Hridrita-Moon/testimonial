import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getOwnedSpace } from "@/lib/spaces";
import { SpaceEditor } from "./SpaceEditor";

/**
 * Dynamic inner of `/dashboard/spaces/<id>/page.tsx`.
 *
 * Loads the space + its `SpaceField` config (scoped to the
 * session user, so a wrong id 404s). Renders the client
 * `SpaceEditor`, which handles PATCH and DELETE.
 *
 * The 3 core fields (name/email/testimonialText) are shown as
 * locked chips — they cannot be edited (per data-model spec
 * §5 / out-of-scope).
 *
 * Runs inside a `<Suspense>` boundary owned by the page. The
 * static shell (the "Edit space" heading + "All spaces" link)
 * renders in the initial response; this content streams in
 * once the params + session + DB reads resolve.
 */
export async function SpaceEditContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;
  const space = await getOwnedSpace(session.user.id, id);
  if (!space) notFound();

  return (
    <>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          href={`/p/${space.publicSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:underline"
        >
          /p/{space.publicSlug}
        </Link>{" "}
        · {space._count.testimonials}{" "}
        {space._count.testimonials === 1 ? "testimonial" : "testimonials"}
      </p>
      <div className="mt-6">
        <SpaceEditor
          space={{
            id: space.id,
            title: space.title,
            subtitle: space.subtitle,
            prompt: space.prompt,
            theme: space.theme === "dark" ? "dark" : "light",
            ratingEnabled: space.ratingEnabled,
            publicSlug: space.publicSlug,
            enabledFields: {
              companyName:
                space.fields.find((f) => f.fieldType === "companyName")
                  ?.enabled ?? false,
              socialLinks:
                space.fields.find((f) => f.fieldType === "socialLinks")
                  ?.enabled ?? false,
              profilePhoto:
                space.fields.find((f) => f.fieldType === "profilePhoto")
                  ?.enabled ?? false,
            },
          }}
        />
      </div>
    </>
  );
}
