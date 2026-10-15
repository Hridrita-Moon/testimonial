"use client";

/**
 * Copy-embed button.
 *
 * Builds the embed snippet from `publicSlug` + `widgetId` via
 * `buildEmbedSnippet`, copies it to the clipboard, and emits a
 * toast on success. Failure surfaces as an error toast so the
 * owner can re-try.
 *
 * We intentionally don't replicate the inline-state "Copied"
 * label the existing `CopyLinkButton` uses — the manager has a
 * dedicated toast stack, and double-signaling (button label +
 * toast) is noisier than useful.
 */

import { useState } from "react";
import { buildEmbedSnippet } from "@/lib/embed-snippet";

export function CopyEmbedButton({
  publicSlug,
  widgetId,
  onSuccess,
  onError,
}: {
  publicSlug: string;
  widgetId: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    const text = buildEmbedSnippet({ publicSlug, widgetId });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts.
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      onSuccess("Embed code copied!");
    } catch {
      onError("Copy failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Copy embed code"
      title="Copy embed code"
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {/* clipboard icon (lucide-style, inline SVG) */}
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
        <rect x="9" y="2" width="6" height="4" rx="1" />
        <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
        <path d="M9 14h6M9 18h4" />
      </svg>
    </button>
  );
}
