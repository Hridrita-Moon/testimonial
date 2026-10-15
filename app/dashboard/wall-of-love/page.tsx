import { Suspense } from "react";
import { WallOfLoveContent } from "./WallOfLoveContent";

/**
 * `/dashboard/wall-of-love` — Wall of Love / Embed Widgets
 * manager (synchronous server component shell).
 *
 * The page itself is a static shell: the "Wall of Love"
 * heading. The space count summary and the widget cards live
 * in `WallOfLoveContent`, an async server component that runs
 * inside a `<Suspense>` boundary and streams in once the
 * session + DB reads resolve.
 *
 * This split is what fixes the "instant navigation dropped
 * segment" warning. Without it, the top-level `await auth()`
 * parks the page inside an implicit Suspense with no
 * fallback, which Next 16's cacheComponents pipeline drops
 * from its instant-UI cache.
 *
 * The Edit action opens a side drawer with a config form on
 * the left and a live `<iframe>` preview of `/p/<slug>/wall?…`
 * on the right. Copy writes the spec'd embed snippet to the
 * clipboard and emits a toast. Delete confirms via
 * `window.confirm` and removes the widget row (the space and
 * its testimonials stay).
 */

export default function WallOfLoveManagerPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Wall of Love
        </h1>
      </header>
      <Suspense fallback={<WallOfLoveContentFallback />}>
        <WallOfLoveContent />
      </Suspense>
    </main>
  );
}

function WallOfLoveContentFallback() {
  return (
    <>
      <div className="mt-1 h-4 w-72 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-48 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" />
        <div className="h-48 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
    </>
  );
}
