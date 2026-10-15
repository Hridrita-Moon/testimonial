"use client";

/**
 * Tiny hand-rolled toast. Slides in from the bottom-right, sits
 * for 2s, then fades. No external deps. Multiple toasts stack.
 *
 * Driven by the parent's `toasts: { id, message }[]` state. Each
 * toast self-dismisses via a `useEffect` timer; the parent is
 * expected to call `onDismiss(id)` so the array can be cleaned up
 * before the slide-out animation finishes (we keep it simple and
 * drop instantly — the next toast pushes the previous one out of
 * the list in the same render).
 */

import { useEffect } from "react";

export interface ToastItem {
  id: string;
  message: string;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const handle = setTimeout(() => onDismiss(item.id), 2000);
    return () => clearTimeout(handle);
  }, [item.id, onDismiss]);

  return (
    <div
      className="pointer-events-auto flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-xl transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
      style={{ animation: "toast-in 200ms ease-out" }}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden className="text-emerald-600 dark:text-emerald-400">
        ✓
      </span>
      {item.message}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
