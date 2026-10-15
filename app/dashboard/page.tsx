import { Suspense } from "react";
import Link from "next/link";
import { DashboardOverview } from "./DashboardOverview";

/**
 * `/dashboard` index.
 *
 * Synchronous server component. The page itself is just a static
 * shell: a `<main>` wrapper, the page heading, and a `+ New
 * space` CTA. The actual data (welcome name, plan stats, quick
 * links, recent activity) lives in `DashboardOverview`, an async
 * server component that runs inside a `<Suspense>` boundary and
 * streams in once the session + DB reads resolve.
 *
 * This split is what fixes the "instant navigation dropped
 * segment" warning. With the previous shape (the page was an
 * `async` function with a top-level `await auth()`), Next 16 had
 * no concrete static shell to cache for the page — the entire
 * render was parked behind an implicit Suspense with no
 * fallback — so the cacheComponents pipeline dropped the page
 * from its instant-UI cache. Splitting the page into a sync
 * outer + async inner + explicit Suspense gives the pipeline a
 * concrete static shell to keep in the cache.
 *
 * The user-specific greeting ("Welcome, <name>") deliberately
 * lives in the dynamic inner rather than the static shell, so
 * the shell does not depend on the session read.
 */

// The heading + CTA render in the initial response, before any
// DB read. While the inner is in flight, the user sees the page
// chrome with the dynamic sections replaced by the
// `DashboardOverviewFallback` skeleton below.
export default function DashboardIndexPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your spaces, inbox, and Wall of Love.
          </p>
        </div>
        <Link
          href="/dashboard/spaces/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New space
        </Link>
      </header>

      <Suspense fallback={<DashboardOverviewFallback />}>
        <DashboardOverview />
      </Suspense>
    </main>
  );
}

/**
 * Skeleton for the dynamic overview sections. Matches the
 * vertical rhythm of the real content so the page doesn't jump
 * as the dynamic chunks stream in. Plain CSS shapes — no
 * library, no animation, no ARIA noise.
 */
function DashboardOverviewFallback() {
  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </section>
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </section>
      <section className="mt-10">
        <div className="h-6 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 h-32 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" />
      </section>
    </>
  );
}
