/**
 * Branded 404 page.
 *
 * Used by Next when no matching route is found. The previous
 * version of the app relied on the stock Next 404, which was
 * visually inconsistent with the rest of the dashboard chrome.
 *
 * The visual treatment mirrors the auth screens (same card
 * surface, same heading vocabulary) so a user who lands on
 * the 404 from any surface sees the same brand voice.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-white/10">
        <p className="text-7xl font-semibold tracking-tighter text-zinc-200 dark:text-zinc-800">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          The page you&apos;re looking for doesn&apos;t exist or has been
          moved. Head back to the dashboard to keep collecting
          testimonials.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
          >
            Go to home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
