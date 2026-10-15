"use client";

/**
 * Small client island that shows a "you're already signed in"
 * banner above the sign-up form if the visitor is
 * authenticated. Renders nothing when the visitor is signed
 * out.
 *
 * Lives inside a `<Suspense>` boundary owned by the page; the
 * one-shot `fetch("/api/auth/session")` call (the same
 * endpoint the rest of the app uses to verify a session)
 * streams in after the static form chrome has rendered. The
 * `ref` guard makes the effect run at most once per mount,
 * so a re-render of the page does not trigger a second
 * session check.
 *
 * The "Go to dashboard" link is a plain `<a>` so the
 * navigation happens via a full GET (not a client-side
 * transition). That keeps the page-load path simple and
 * avoids any chance of an infinite navigation loop with the
 * page's own Suspense boundary.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function AlreadySignedInBanner({ next }: { next: string }) {
  const ran = useRef(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", {
          credentials: "same-origin",
        });
        if (!res.ok) {
          if (!cancelled) setSignedIn(false);
          return;
        }
        const data = (await res.json().catch(() => null)) as {
          user?: { id?: string };
        } | null;
        if (cancelled) return;
        setSignedIn(Boolean(data?.user?.id));
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (signedIn !== true) return null;

  return (
    <div
      className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      role="status"
    >
      You are already signed in.{" "}
      <Link
        href={next}
        className="font-medium underline-offset-4 hover:underline"
      >
        Go to dashboard
      </Link>{" "}
      or sign out below to create a new account.
    </div>
  );
}
