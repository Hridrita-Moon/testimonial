import { Suspense } from "react";
import Link from "next/link";
import { SignUpForm } from "./SignUpForm";
import { AlreadySignedInBanner } from "./AlreadySignedInBanner";

/**
 * Dynamic inner of `/sign-up/page.tsx`.
 *
 * Reads the `?next=` search param, then renders the form
 * with that value. Runs inside a `<Suspense>` boundary
 * owned by the page so the static card chrome (heading,
 * subhead) renders in the initial response, and the
 * search-param-dependent form streams in once the param
 * resolves.
 *
 * The "you're already signed in" banner is a client island
 * that calls `/api/auth/session` on mount; it renders
 * nothing when the visitor is signed out, so it's safe to
 * include here for both signed-in and signed-out users.
 */

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export async function SignUpCard({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const safeNextValue = safeNext(next);
  return (
    <>
      <Suspense fallback={null}>
        <AlreadySignedInBanner next={safeNextValue ?? "/dashboard"} />
      </Suspense>

      <div className="mt-6">
        <SignUpForm next={safeNextValue} />
      </div>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href={`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline hover:text-zinc-950 transition-colors duration-150 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}
