"use client";

/**
 * Edit-widget side drawer.
 *
 * Right-side slide-in panel (max-w-3xl on md+, full-width sheet
 * on small). Two columns:
 *   - left:  config form (layout picker, theme picker,
 *            scrollDirection, showHeart, hideDate, hideSource) +
 *            Save / Cancel buttons.
 *   - right: live preview = `<iframe src="/p/<slug>/wall?...">`.
 *            The iframe URL is recomputed from the form's
 *            in-memory state so the preview reflects unsaved
 *            changes; all six config fields are forwarded.
 *            Saving the form hits `PATCH /api/widgets/<widgetId>`
 *            and on success the parent closes the drawer and
 *            refreshes the list.
 *
 * The drawer mounts a fresh `<form>` per open so a cancel never
 * leaks unsaved state into the next open.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LayoutPicker } from "./LayoutPicker";
import type { WidgetLayout } from "@/lib/validation/widget";

export interface WidgetConfig {
  widgetId: string;
  theme: "light" | "dark";
  layout: WidgetLayout;
  scrollDirection: "up" | "down";
  showHeart: boolean;
  hideDate: boolean;
  hideSource: boolean;
}

export interface EditWidgetDrawerProps {
  publicSlug: string;
  spaceTitle: string;
  widget: WidgetConfig;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

export function EditWidgetDrawer({
  publicSlug,
  spaceTitle,
  widget,
  onClose,
  onSaved,
  onError,
}: EditWidgetDrawerProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<WidgetConfig["theme"]>(widget.theme);
  const [layout, setLayout] = useState<WidgetConfig["layout"]>(widget.layout);
  const [scrollDirection, setScrollDirection] = useState<WidgetConfig["scrollDirection"]>(widget.scrollDirection);
  const [showHeart, setShowHeart] = useState<boolean>(widget.showHeart);
  const [hideDate, setHideDate] = useState<boolean>(widget.hideDate);
  const [hideSource, setHideSource] = useState<boolean>(widget.hideSource);
  const [saving, setSaving] = useState(false);

  // Esc closes the drawer (mirrors the modal pattern).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // `bust` increments whenever the owner asks the preview
  // iframe to reload (e.g. after toggling "Add to Wall" on a
  // testimonial elsewhere). The iframe is keyed on `bust` so
  // flipping it forces React to remount the iframe and re-
  // request `/p/<slug>/wall`, which is what makes a per-
  // testimonial toggle show up in the preview.
  const [bust, setBust] = useState(0);
  const previewKey = `preview-${publicSlug}-${bust}`;

  const previewSrc = useMemo(() => {
    const params = new URLSearchParams();
    params.set("theme", theme);
    params.set("layout", layout);
    if (hideDate) params.set("hideDate", "1");
    if (hideSource) params.set("hideSource", "1");
    if (!showHeart) params.set("showHeart", "0");
    params.set("scrollDirection", scrollDirection);
    return `/p/${publicSlug}/wall?${params.toString()}`;
  }, [publicSlug, theme, layout, scrollDirection, showHeart, hideDate, hideSource]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/widgets/${encodeURIComponent(widget.widgetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          layout,
          scrollDirection,
          showHeart,
          hideDate,
          hideSource,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(data.message ?? data.error ?? `Save failed (${res.status})`);
      }
      onSaved("Widget saved");
      router.refresh();
      onClose();
    } catch (e) {
      onError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/50"
      onClick={() => !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit widget for ${spaceTitle}`}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-baseline justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Edit widget
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {spaceTitle} · <code className="font-mono">{widget.widgetId}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Body — form on the left, preview on the right */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
          {/* Form column */}
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-5 overflow-y-auto border-r border-zinc-200 px-6 py-5 dark:border-zinc-800"
          >
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
                name="theme"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </fieldset>

            {/* Scroll direction is only relevant for the animated
                layout; we still show it for the fixed + carousel
                variants because the carousel honors scroll
                direction for keyboard arrow affordances and a
                future "auto-advance" toggle might. */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Scroll direction
              </legend>
              <SegmentedControl
                name="scrollDirection"
                value={scrollDirection}
                onChange={setScrollDirection}
                options={[
                  { value: "up", label: "Up" },
                  { value: "down", label: "Down" },
                ]}
              />
            </fieldset>

            <Toggle
              id="showHeart"
              label="Show heart animation"
              checked={showHeart}
              onChange={setShowHeart}
            />
            <Toggle
              id="hideDate"
              label="Hide date"
              checked={hideDate}
              onChange={setHideDate}
            />
            <Toggle
              id="hideSource"
              label="Hide source icons"
              checked={hideSource}
              onChange={setHideSource}
            />

            <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>

          {/* Preview column */}
          <div className="flex flex-col gap-2 overflow-hidden bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Live preview
              </p>
              <button
                type="button"
                onClick={() => setBust((b) => b + 1)}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                aria-label="Refresh preview"
                title="Refresh preview"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                Refresh
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-inner dark:border-zinc-800">
              <iframe
                key={previewKey}
                title={`Preview of ${publicSlug}`}
                src={previewSrc}
                className="h-full w-full"
                style={{ minHeight: 480 }}
              />
            </div>
          </div>
        </div>
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
      className="inline-flex w-fit rounded-md border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
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
                ? "rounded px-3 py-1 text-sm font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "rounded px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
            ? "relative inline-flex h-5 w-9 items-center rounded-full bg-zinc-900 transition-colors dark:bg-zinc-100"
            : "relative inline-flex h-5 w-9 items-center rounded-full bg-zinc-300 transition-colors dark:bg-zinc-700"
        }
      >
        <span
          className={
            checked
              ? "inline-block h-4 w-4 translate-x-4 transform rounded-full bg-white transition-transform dark:bg-zinc-900"
              : "inline-block h-4 w-4 translate-x-0.5 transform rounded-full bg-white transition-transform dark:bg-zinc-200"
          }
        />
      </button>
    </label>
  );
}
