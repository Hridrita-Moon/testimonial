/**
 * Sign-up page (`/sign-up`).
 *
 * Synchronous server component. The page itself is the static
 * card chrome: heading, subhead. The form, the "already signed
 * in" banner, and the "Already have an account?" link live in
 * `SignUpCard`, an async server component that runs inside a
 * `<Suspense>` boundary and streams in once the `?next=`
 * search param resolves.
 *
 * Earlier versions of this page called `await auth()` at the
 * top level and threw `redirect("/dashboard")` when the
 * visitor was already signed in. That produced two visible
 * bugs:
 *
 *   1. A signed-in user clicking "Create your free account"
 *      from the landing page was silently redirected to the
 *      dashboard with no explanation — they never saw the
 *      form, which made it look like the page was broken.
 *
 *   2. The top-level `await auth()` parked the page inside
 *      an implicit Suspense with no fallback, which Next 16's
 *      cacheComponents pipeline dropped from its instant-UI
 *      cache with the "instant navigation dropped segment"
 *      warning.
 *
 * The new shape: the form always renders. If the user is
 * already signed in, a small banner above the form offers a
 * "Go to dashboard" link. The signed-in check happens
 * client-side via a small island (see
 * `AlreadySignedInBanner`).
 */

import { Suspense } from "react";
import { SignUpCard } from "./SignUpCard";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default function SignUpPage({ searchParams }: PageProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-white/10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Collect testimonials, manage your inbox, and publish a Wall of
          Love — all in one place.
        </p>

        <Suspense fallback={<SignUpCardFallback />}>
          <SignUpCard searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

/**
 * Static fallback for the form area. Matches the rhythm of the
 * real card (3 input rows + submit button) so the page doesn't
 * jump as the search param resolves. Plain CSS shapes — no
 * animation, no ARIA noise.
 */
function SignUpCardFallback() {
  return (
    <>
      <div className="mt-6 flex flex-col gap-4" aria-hidden>
        <div className="h-9 rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
        <div className="h-9 rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
        <div className="h-9 rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
        <div className="h-9 rounded-md bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="mt-6 h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
    </>
  );
}
