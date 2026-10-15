import { Suspense } from "react";
import { NewSpaceContent } from "./NewSpaceContent";

/**
 * `/dashboard/spaces/new` — synchronous server component shell.
 *
 * The page itself is a static shell: the "New space" heading.
 * The slot-remaining hint + form live in `NewSpaceContent`, an
 * async server component that runs inside a `<Suspense>`
 * boundary and streams in once the session + DB reads resolve.
 *
 * This split is what fixes the "instant navigation dropped
 * segment" warning. Without it, the top-level `await auth()`
 * parks the page inside an implicit Suspense with no
 * fallback, which Next 16's cacheComponents pipeline drops
 * from its instant-UI cache.
 */

export default function NewSpacePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          New space
        </h1>
      </header>
      <Suspense fallback={<NewSpaceContentFallback />}>
        <NewSpaceContent />
      </Suspense>
    </main>
  );
}

function NewSpaceContentFallback() {
  return (
    <>
      <div className="mt-1 h-4 w-full max-w-md rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 h-72 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" />
    </>
  );
}
