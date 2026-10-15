"use client";

/**
 * Client-side redirector.
 *
 * This exists because Next.js 16's `instant`-navigation validation
 * pass cannot survive a server-side `redirect()` throw. When a
 * server component (layout or page) opts in to `instant` and calls
 * `redirect(...)`, the throw aborts the validation pass and the
 * user sees a runtime error in the console ("Could not validate
 * `instant` because the target segment was prevented from
 * rendering, ... Caused by: Error: NEXT_REDIRECT").
 *
 * Replacing the throw with this island lets the server component
 * return a real React node. The island mounts after hydration and
 * `router.replace()`s to `<to>`. The same one-shot `useRef` guard
 * pattern as `app/(auth)/sign-in/AlreadySignedIn` keeps us from
 * issuing duplicate navigations on React re-renders.
 *
 * We render `null` so the segment is empty while the redirect is
 * in flight. The browser starts the client-side navigation
 * immediately on mount; the user sees the destination URL by the
 * next paint.
 *
 * Two named exports:
 *   - `<Redirect to="/x" />` — generic; use for any non-`/sign-in`
 *     destination. Avoids the `redirect()` throw entirely.
 *   - `<RedirectToSignIn next="/dashboard" />` — thin wrapper that
 *     builds `/sign-in?next=<next>` for you.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function Redirect({ to }: { to: string }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    router.replace(to);
  }, [router, to]);

  return null;
}

export function RedirectToSignIn({ next }: { next: string }) {
  return <Redirect to={`/sign-in?next=${encodeURIComponent(next)}`} />;
}
