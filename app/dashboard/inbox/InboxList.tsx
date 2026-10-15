"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditTestimonialDialog } from "./EditTestimonialDialog";

/**
 * Inbox list (client island).
 *
 * Each card has a row of action buttons that fire per-action API
 * calls and `router.refresh()` the page on success. The edit
 * button opens a small modal with the testimonial's current
 * values; on save the modal PATCHes and refreshes.
 *
 * The cards include `contributorEmail` — visible to the owner
 * only (the public surface never returns it).
 */

export interface InboxTestimonial {
  id: string;
  contributorName: string;
  contributorEmail: string;
  testimonialText: string;
  rating: number | null;
  additionalValues: unknown;
  isFavorite: boolean;
  isWallOfLove: boolean;
  visibilityStatus: string;
  submissionTimestamp: string;
  space: { id: string; title: string; ratingEnabled: boolean };
}

export function InboxList({ testimonials }: { testimonials: InboxTestimonial[] }) {
  if (testimonials.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        No testimonials to show.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {testimonials.map((t) => (
        <InboxRow key={t.id} testimonial={t} />
      ))}
    </ul>
  );
}

function InboxRow({ testimonial }: { testimonial: InboxTestimonial }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function call(path: string, body: unknown) {
    setBusy(path);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!confirm(`Delete this testimonial from ${testimonial.contributorName}?`)) {
      return;
    }
    setBusy("delete");
    try {
      const res = await fetch(`/api/testimonials/${testimonial.id}`, {
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
      alert((e as Error).message);
      setBusy(null);
    }
  }

  const date = new Date(testimonial.submissionTimestamp);

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {testimonial.contributorName}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {testimonial.contributorEmail} · {testimonial.space.title} ·{" "}
            {date.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {testimonial.rating != null && testimonial.space.ratingEnabled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {testimonial.rating} ★
            </span>
          ) : null}
          {testimonial.visibilityStatus === "hidden" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              Hidden
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm text-zinc-800 dark:text-zinc-200">
        {testimonial.testimonialText}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* "Add to wall" is the primary action on this row. When
            ON the chip is a rose pill with a filled heart; when
            OFF it's an outlined chip with an empty heart. The
            single click toggles the testimonial in/out of the
            Wall of Love AND `router.refresh()`es the manager
            page so the new row shows up (or disappears) on the
            wall without a manual reload. */}
        <ActionButton
          onClick={() =>
            call(`/api/testimonials/${testimonial.id}/wall-of-love`, {
              wallOfLove: !testimonial.isWallOfLove,
            })
          }
          busy={busy === `/api/testimonials/${testimonial.id}/wall-of-love`}
          variant={testimonial.isWallOfLove ? "wallOn" : "wallOff"}
        >
          <span aria-hidden className="mr-1">
            {testimonial.isWallOfLove ? "♥" : "♡"}
          </span>
          {testimonial.isWallOfLove ? "On the wall" : "Add to wall"}
        </ActionButton>
        <ActionButton
          onClick={() =>
            call(`/api/testimonials/${testimonial.id}/favorite`, {
              favorite: !testimonial.isFavorite,
            })
          }
          busy={busy === `/api/testimonials/${testimonial.id}/favorite`}
          variant={testimonial.isFavorite ? "primary" : "ghost"}
        >
          {testimonial.isFavorite ? "★ Favorited" : "☆ Favorite"}
        </ActionButton>
        <ActionButton
          onClick={() =>
            call(`/api/testimonials/${testimonial.id}/visibility`, {
              visibility:
                testimonial.visibilityStatus === "hidden"
                  ? "published"
                  : "hidden",
            })
          }
          busy={busy === `/api/testimonials/${testimonial.id}/visibility`}
          variant="ghost"
        >
          {testimonial.visibilityStatus === "hidden" ? "Unhide" : "Hide"}
        </ActionButton>
        <ActionButton onClick={() => setEditing(true)} variant="ghost">
          Edit
        </ActionButton>
        <ActionButton
          onClick={onDelete}
          busy={busy === "delete"}
          variant="danger"
        >
          Delete
        </ActionButton>
      </div>

      {editing ? (
        <EditTestimonialDialog
          testimonial={testimonial}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </li>
  );
}

function ActionButton({
  onClick,
  busy,
  variant,
  children,
}: {
  onClick: () => void;
  busy?: boolean;
  variant: "primary" | "ghost" | "danger" | "wallOn" | "wallOff";
  children: React.ReactNode;
}) {
  const base =
    "inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed";
  const styles: Record<typeof variant, string> = {
    primary:
      "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
    ghost:
      "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600",
    danger:
      "border border-red-300 bg-white text-red-700 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/50",
    // "On the wall" — filled rose chip, slightly larger than the
    // other ghost buttons so it reads as the row's primary toggle.
    wallOn:
      "border border-rose-300 bg-rose-500 text-white shadow-sm hover:bg-rose-600 dark:border-rose-700 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400",
    // "Add to wall" — outlined rose chip. The heart icon flips
    // between filled (♥) and hollow (♡) to communicate state at a
    // glance.
    wallOff:
      "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-950/40",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`${base} ${styles[variant]}`}
    >
      {children}
    </button>
  );
}
