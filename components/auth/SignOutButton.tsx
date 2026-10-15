"use client";

/**
 * Sign-out button used in the dashboard top bar.
 *
 * The Auth.js v5 client SDK has `signOut()` from
 * `next-auth/react`, but it triggers a full page navigation. We
 * prefer `window.location.assign("/")` so the browser discards any
 * server-component state and the user lands cleanly on the
 * marketing landing.
 */

import { useState } from "react";
import { signOut } from "next-auth/react";

export function SignOutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={
        className ??
        "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      }
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
