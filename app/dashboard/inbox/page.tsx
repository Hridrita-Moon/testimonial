import { Suspense } from "react";
import { InboxContent } from "./InboxContent";

/**
 * `/dashboard/inbox` — synchronous server component shell.
 *
 * The page itself is a static shell: `<main>` wrapper + the
 * "Inbox" heading. The filter bar, the count summary, and the
 * list itself live in `InboxContent`, an async server component
 * that runs inside a `<Suspense>` boundary and streams in once
 * the search params + DB reads resolve.
 *
 * This split is what fixes the "instant navigation dropped
 * segment" warning. With the previous shape (the page was an
 * `async` function with a top-level `await searchParams`), Next
 * 16 had no concrete static shell to cache for the page — the
 * entire render was parked behind an implicit Suspense with no
 * fallback — so the cacheComponents pipeline dropped the page
 * from its instant-UI cache. Splitting the page into a sync
 * outer + async inner + explicit Suspense gives the pipeline a
 * concrete static shell to keep in the cache.
 *
 * Filter state lives in the URL (so deep links and
 * back-button work). The list is a client island because each
 * card's action buttons fire per-action API calls and
 * `router.refresh()` after success.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function InboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Inbox
          </h1>
        </div>
      </header>

      <Suspense fallback={<InboxContentFallback />}>
        <InboxContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/**
 * Skeleton shown while the inner reads resolve. Matches the
 * real content's vertical rhythm (count summary line + filter
 * bar + list) so the page doesn't jump as chunks stream in.
 */
function InboxContentFallback() {
  return (
    <>
      <div className="mt-1 h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 h-12 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" />
      <div className="mt-6 h-48 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" />
    </>
  );
}
