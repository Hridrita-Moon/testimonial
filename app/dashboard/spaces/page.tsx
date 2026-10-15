import { Suspense } from "react";
import Link from "next/link";
import { SpacesListContent } from "./SpacesListContent";

/**
 * `/dashboard/spaces` — synchronous server component shell.
 *
 * The page itself is a static shell: the "Spaces" heading and
 * a `+ New space` CTA. The list of owned spaces lives in
 * `SpacesListContent`, an async server component that runs
 * inside a `<Suspense>` boundary and streams in once the
 * session + DB reads resolve.
 *
 * This split is what fixes the "instant navigation dropped
 * segment" warning. Without it, the top-level `await auth()`
 * parks the page inside an implicit Suspense with no
 * fallback, which Next 16's cacheComponents pipeline drops
 * from its instant-UI cache.
 *
 * Each row links to the public page (`/p/<slug>`), the edit
 * page (`/dashboard/spaces/<id>`), and has a delete button.
 */

export default function SpacesListPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Spaces
          </h1>
        </div>
        <Link
          href="/dashboard/spaces/new"
          className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + New space
        </Link>
      </header>

      <Suspense fallback={<SpacesListContentFallback />}>
        <SpacesListContent />
      </Suspense>
    </main>
  );
}

function SpacesListContentFallback() {
  return (
    <>
      <div className="mt-1 h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 h-48 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" />
    </>
  );
}
