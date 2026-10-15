/**
 * Sign-in page (`/sign-in`).
 *
 * Server component that renders the static shell of the sign-in
 * card, then mounts a small client island that handles:
 *   - reading `?next=` via `useSearchParams()` (no server-side
 *     await on the search params, so the static shell streams
 *     immediately and is not gated by an implicit Suspense);
 *   - reading the session via `useSession()` and, if the user is
 *     already signed in, `router.replace()`ing them to the next
 *     URL (or `/dashboard`).
 *
 * The previous version of this page called `await auth()` and
 * `await searchParams` at the top level. With Next 16's cache
 * components + partial prerendering, those awaits parked the
 * entire page inside an implicit `<Suspense>` whose fallback
 * (the empty streaming chunk) is what the user saw on a slow
 * client — i.e. a blank screen until the chunk arrived. Moving
 * the dynamic reads into a client island lets the static shell
 * (the form) render in the initial response and removes the
 * implicit Suspense lock.
 *
 * If the visitor is already signed in, the `AlreadySignedIn`
 * client island below `router.replace()`s them out of the page
 * without re-rendering the form. The flash of the form is a
 * single frame and is acceptable for an auth boundary.
 */

import { Suspense } from "react";
import Link from "next/link";
import { SignInForm } from "./SignInForm";
import { AlreadySignedIn } from "./AlreadySignedIn";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Welcome back. Sign in to manage your testimonial spaces.
        </p>
        <div className="mt-6">
          <Suspense fallback={<SignInFormFallback />}>
            <SignInForm />
          </Suspense>
        </div>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            Create one
          </Link>
        </p>
        <Suspense fallback={null}>
          <AlreadySignedIn />
        </Suspense>
      </div>
    </main>
  );
}

/**
 * Static fallback shown while the `useSearchParams()` call inside
 * `SignInForm` resolves. The form is a controlled form with
 * `useState` defaults, so a no-op placeholder keeps the layout
 * stable instead of jumping as the island mounts.
 */
function SignInFormFallback() {
  return (
    <form className="flex flex-col gap-4" noValidate aria-hidden>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Email
        </label>
        <div className="h-9 rounded-md border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Password
        </label>
        <div className="h-9 rounded-md border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
      </div>
      <button
        type="button"
        disabled
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Sign in
      </button>
    </form>
  );
}
