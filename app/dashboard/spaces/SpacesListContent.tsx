import Link from "next/link";
import { auth } from "@/lib/auth";
import { listOwnedSpaces } from "@/lib/spaces";
import { DeleteSpaceButton } from "./DeleteSpaceButton";

/**
 * Dynamic inner of `/dashboard/spaces/page.tsx`.
 *
 * Each row links to the public page (`/p/<slug>`), the edit
 * page (`/dashboard/spaces/<id>`), and has a delete button. The
 * delete button is a client island that POSTs `DELETE` and
 * `router.refresh()`es the list on success.
 *
 * Runs inside a `<Suspense>` boundary owned by the page.
 */
export async function SpacesListContent() {
  const session = await auth();
  if (!session?.user) return null;
  const spaces = await listOwnedSpaces(session.user.id);

  return (
    <>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {spaces.length === 0
          ? "Create your first space to start collecting testimonials."
          : `${spaces.length} ${spaces.length === 1 ? "space" : "spaces"}.`}
      </p>

      {spaces.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No spaces yet. Click{" "}
            <span className="font-medium">+ New space</span> above to get
            started.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {spaces.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {s.title}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  /{s.publicSlug} · {s._count.testimonials}{" "}
                  {s._count.testimonials === 1 ? "testimonial" : "testimonials"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/p/${s.publicSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
                >
                  View public
                </Link>
                <Link
                  href={`/dashboard/spaces/${s.id}`}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
                >
                  Edit
                </Link>
                <DeleteSpaceButton publicSlug={s.publicSlug} title={s.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
