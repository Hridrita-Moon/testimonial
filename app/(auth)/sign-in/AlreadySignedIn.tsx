"use client";

/**
 * Client-side "already signed in" redirector.
 *
 * The page-level session check used to live in the server
 * component as `await auth()`. That blocked the entire sign-in
 * page inside an implicit Suspense (the static shell could not
 * stream until the auth() call resolved), which manifested as a
 * blank screen for users on slow clients.
 *
 * This island runs the same check in a `useEffect` after mount.
 * The previous version called `useSession()` from
 * `next-auth/react`, which throws unless a `<SessionProvider>`
 * is mounted somewhere up the tree — this app does not have
 * one, so that approach was wrong. We now do a one-shot
 * `GET /api/auth/session` (the same endpoint the rest of the
 * app uses to verify a session) and redirect on a positive
 * response.
 *
 * The `ref` flag ensures the effect runs at most once per
 * mount, so there is no infinite-loop risk: even if the
 * `router.replace` somehow didn't unmount us, the second run
 * would still no-op (it sets `ref` again, but the early return
 * is unconditional).
 */

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export function AlreadySignedIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "same-origin" });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as { user?: { id?: string } } | null;
        if (cancelled) return;
        if (data?.user?.id) {
          const target = safeNext(searchParams?.get("next")) ?? "/dashboard";
          router.replace(target);
        }
      } catch {
        // Network or parse error — silently ignore. The user
        // will see the sign-in form and can sign in normally.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return null;
}
