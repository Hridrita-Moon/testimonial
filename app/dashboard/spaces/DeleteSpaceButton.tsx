"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Delete button used in the spaces list. The actual `DELETE` is
 * fired from the client because the row is interactive — we want
 * a confirm() and a loading state without a full page reload.
 */

export function DeleteSpaceButton({
  publicSlug,
  title,
}: {
  publicSlug: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${publicSlug}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </>
  );
}
