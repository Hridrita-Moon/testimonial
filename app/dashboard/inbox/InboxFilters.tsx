"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import type { InboxFilter } from "@/lib/validation/inbox";

/**
 * Filter bar for the inbox.
 *
 * Filter state lives in the URL as search params. The form
 * submits (on change of any field) by calling `router.push` with
 * a new query string. `useTransition` keeps the page responsive
 * while the server re-renders the inbox.
 *
 * The `current` prop is the parsed `InboxFilter` so the inputs
 * are pre-populated to match the URL.
 */

interface SpaceOption {
  id: string;
  title: string;
}

export function InboxFilters({
  spaces,
  current,
}: {
  spaces: SpaceOption[];
  current: InboxFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function apply(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    apply({
      spaceId: (fd.get("spaceId") as string) || undefined,
      rating: (fd.get("rating") as string) || undefined,
      visibility: (fd.get("visibility") as string) || undefined,
      fromDate: (fd.get("fromDate") as string) || undefined,
      toDate: (fd.get("toDate") as string) || undefined,
      q: (fd.get("q") as string) || undefined,
      favorite: fd.get("favorite") === "on" ? "1" : undefined,
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Space
        </label>
        <select
          name="spaceId"
          defaultValue={current.spaceId ?? ""}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">All spaces</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Rating
        </label>
        <select
          name="rating"
          defaultValue={current.rating ?? ""}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={String(n)}>
              {n} ★
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Visibility
        </label>
        <select
          name="visibility"
          defaultValue={current.visibility ?? ""}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Published (default)</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Search
        </label>
        <input
          name="q"
          type="search"
          defaultValue={current.q ?? ""}
          placeholder="Name or text…"
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          From
        </label>
        <input
          name="fromDate"
          type="date"
          defaultValue={
            current.fromDate
              ? current.fromDate.toISOString().slice(0, 10)
              : ""
          }
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          To
        </label>
        <input
          name="toDate"
          type="date"
          defaultValue={
            current.toDate ? current.toDate.toISOString().slice(0, 10) : ""
          }
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <label className="flex items-end gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          name="favorite"
          type="checkbox"
          defaultChecked={Boolean(current.favorite)}
        />
        Favorites only
      </label>

      <div className="flex items-end gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
        >
          {isPending ? "Filtering…" : "Apply"}
        </button>
        <a
          href="/dashboard/inbox"
          className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline hover:text-zinc-950 transition-colors duration-150 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          Reset
        </a>
      </div>
    </form>
  );
}
