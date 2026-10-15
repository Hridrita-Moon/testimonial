"use client";

/**
 * Delete-widget button.
 *
 * Confirms via a native `window.confirm` (the existing
 * `DeleteSpaceButton` follows the same convention — we don't pull
 * in a confirmation modal for a one-off destructive action).
 *
 * On success: `DELETE /api/widgets/<widgetId>`, then
 * `router.refresh()` so the server-rendered card grid rebuilds
 * without the deleted row. Emits a toast.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteWidgetButton({
  widgetId,
  spaceTitle,
  onSuccess,
  onError,
}: {
  widgetId: string;
  spaceTitle: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    const ok = window.confirm(
      `Delete the widget for "${spaceTitle}"? The space and its testimonials stay; only the widget config is removed.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/widgets/${encodeURIComponent(widgetId)}`, {
        method: "DELETE",
      });
      if (res.status === 204) {
        onSuccess("Widget deleted");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      onError(data.error ?? `Delete failed (${res.status})`);
    } catch {
      onError("Delete failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Delete widget"
      title="Delete widget"
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition-all duration-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-red-950/40 dark:hover:text-red-300 dark:hover:border-red-800"
    >
      {/* trash icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}
