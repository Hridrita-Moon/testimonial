import { Suspense } from "react";
import Link from "next/link";
import { SpaceEditContent } from "./SpaceEditContent";

/**
 * `/dashboard/spaces/<id>` — synchronous server component shell.
 *
 * The page itself is a static shell: the "Edit space" heading
 * and a "All spaces" link. The space details and editor live
 * in `SpaceEditContent`, an async server component that runs
 * inside a `<Suspense>` boundary and streams in once the
 * params + session + DB reads resolve.
 *
 * This split is what fixes the "instant navigation dropped
 * segment" warning. Without it, the top-level `await params`
 * parks the page inside an implicit Suspense with no
 * fallback, which Next 16's cacheComponents pipeline drops
 * from its instant-UI cache.
 */

export default function SpaceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Edit space
          </h1>
        </div>
        <Link
          href="/dashboard/spaces"
          className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← All spaces
        </Link>
      </header>
      <Suspense fallback={<SpaceEditContentFallback />}>
        <SpaceEditContent params={params} />
      </Suspense>
    </main>
  );
}

function SpaceEditContentFallback() {
  return (
    <>
      <div className="mt-1 h-4 w-72 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 h-96 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" />
    </>
  );
}
