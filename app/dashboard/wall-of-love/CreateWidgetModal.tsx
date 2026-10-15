"use client";

/**
 * `+ Create Wall of Love` modal.
 *
 * Centered modal (max-w-xl) opened from the `/dashboard/wall-of-love`
 * header. Two steps collapsed into one form:
 *
 *   1. Pick a space — dropdown of owned spaces that do NOT yet
 *      have a widget. (If a space already has a widget, the
 *      manager renders a card with an Edit button instead —
 *      there's no "create a second widget for the same space"
 *      flow, because the underlying schema enforces a 1:1.)
 *
 *   2. Configure the widget — layout picker (reused from
 *      `LayoutPicker`) + theme + scroll direction + the three
 *      booleans. These all match the schema columns the public
 *      wall reads, so the widget's first render is the same as
 *      what the owner picked here.
 *
 * Submit hits `POST /api/widgets` with the full body. On success
 * we toast + `router.refresh()` so the page server-renders the
 * new card; the modal closes.
 *
 * The modal is mounted with a fresh form per open so cancel
 * never leaks draft state into the next open.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LayoutPicker } from "./LayoutPicker";
import type { WidgetLayout } from "@/lib/validation/widget";

export interface CreateWidgetSpaceOption {
  id: string;
  title: string;
  publicSlug: string;
  ratingEnabled: boolean;
}

export interface CreateWidgetModalProps {
  availableSpaces: CreateWidgetSpaceOption[];
  onClose: () => void;
  onCreated: (msg: string) => void;
  onError: (msg: string) => void;
}

type Theme = "light" | "dark";
type Scroll = "up" | "down";

export function CreateWidgetModal({
  availableSpaces,
  onClose,
  onCreated,
  onError,
}: CreateWidgetModalProps) {
  const router = useRouter();
  const hasSpaces = availableSpaces.length > 0;
  const [spaceId, setSpaceId] = useState<string>(availableSpaces[0]?.id ?? "");
  const [layout, setLayout] = useState<WidgetLayout>("masonryAnimated");
  const [theme, setTheme] = useState<Theme>("light");
  const [scrollDirection, setScrollDirection] = useState<Scroll>("up");
  const [showHeart, setShowHeart] = useState(true);
  const [hideDate, setHideDate] = useState(false);
  const [hideSource, setHideSource] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!spaceId) {
      onError("Pick a space first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId,
          layout,
          theme,
          scrollDirection,
          showHeart,
          hideDate,
          hideSource,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(data.message ?? data.error ?? `Create failed (${res.status})`);
      }
      onCreated("Widget created");
      router.refresh();
      onClose();
    } catch (e) {
      onError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm p-4"
      onClick={() => !submitting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Create a new wall of love widget"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-baseline justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Create Wall of Love
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Pick a space and the layout. You can fine-tune later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-500 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-5 overflow-y-auto px-6 py-5"
        >
          {!hasSpaces ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <p className="font-medium">No spaces available.</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Every space you own already has a widget, or you don&apos;t
                own any spaces yet. Create a space first to add a wall.
              </p>
            </div>
          ) : (
            <fieldset className="flex flex-col gap-1.5">
              <label
                htmlFor="create-widget-space"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Space
              </label>
              <select
                id="create-widget-space"
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                disabled={submitting}
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {availableSpaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · /p/{s.publicSlug}
                  </option>
                ))}
              </select>
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Layout
            </legend>
            <LayoutPicker value={layout} onChange={setLayout} />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Theme
            </legend>
            <SegmentedControl
              name="create-theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Scroll direction
            </legend>
            <SegmentedControl
              name="create-scroll"
              value={scrollDirection}
              onChange={setScrollDirection}
              options={[
                { value: "up", label: "Up" },
                { value: "down", label: "Down" },
              ]}
            />
          </fieldset>

          <Toggle
            id="create-showHeart"
            label="Show heart animation"
            checked={showHeart}
            onChange={setShowHeart}
          />
          <Toggle
            id="create-hideDate"
            label="Hide date"
            checked={hideDate}
            onChange={setHideDate}
          />
          <Toggle
            id="create-hideSource"
            label="Hide source icons"
            checked={hideSource}
            onChange={setHideSource}
          />

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-60 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !hasSpaces}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
            >
              {submitting ? "Creating…" : "Create widget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="inline-flex w-fit rounded-md border border-zinc-300 bg-zinc-100 p-0.5 transition-all duration-200 dark:border-zinc-700 dark:bg-zinc-800/50"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={
              active
                ? "rounded px-3 py-1 text-sm font-medium bg-zinc-900 text-white shadow-sm transition-all duration-200 dark:bg-zinc-100 dark:text-zinc-900"
                : "rounded px-3 py-1 text-sm font-medium text-zinc-700 transition-colors duration-150 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3"
    >
      <span className="text-sm text-zinc-800 dark:text-zinc-200">{label}</span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          checked
            ? "relative inline-flex h-5 w-9 items-center rounded-full bg-zinc-900 transition-all duration-200 dark:bg-zinc-100"
            : "relative inline-flex h-5 w-9 items-center rounded-full bg-zinc-300 transition-all duration-200 dark:bg-zinc-700"
        }
      >
        <span
          className={
            checked
              ? "inline-block h-4 w-4 translate-x-4 transform rounded-full bg-white shadow-sm transition-transform dark:bg-zinc-900"
              : "inline-block h-4 w-4 translate-x-0.5 transform rounded-full bg-white shadow-sm transition-transform dark:bg-zinc-200"
          }
        />
      </button>
    </label>
  );
}
