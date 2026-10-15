"use client";

import { useState } from "react";

/**
 * Tiny client button that copies a string to the clipboard using
 * the `navigator.clipboard` API. We fall back to a manual
 * `document.execCommand("copy")` shim when the async API is
 * unavailable (older browsers, insecure contexts).
 */

export function CopyLinkButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function onClick() {
    setError(false);
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
    >
      {copied ? "Copied" : error ? "Copy failed" : "Copy"}
    </button>
  );
}
