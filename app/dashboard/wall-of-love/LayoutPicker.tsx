"use client";

/**
 * Widget layout picker.
 *
 * Renders the three layout options as cards. Each card has:
 *   - a small icon tile tinted with the layout's accent color,
 *   - the friendly label,
 *   - a one-line description,
 *   - a radio control (the entire card is a `<label>` so
 *     clicking anywhere on it selects the option).
 *
 * Used by both `EditWidgetDrawer` and `CreateWidgetModal`.
 */

import { WIDGET_LAYOUTS, type WidgetLayoutMeta } from "@/lib/widget-layouts";
import type { WidgetLayout } from "@/lib/validation/widget";

export function LayoutPicker({
  value,
  onChange,
  name = "layout",
}: {
  value: WidgetLayout;
  onChange: (v: WidgetLayout) => void;
  name?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Widget layout"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {WIDGET_LAYOUTS.map((layout) => (
        <LayoutCard
          key={layout.id}
          meta={layout}
          selected={value === layout.id}
          onSelect={() => onChange(layout.id)}
          name={name}
        />
      ))}
    </div>
  );
}

function LayoutCard({
  meta,
  selected,
  onSelect,
  name,
}: {
  meta: WidgetLayoutMeta;
  selected: boolean;
  onSelect: () => void;
  name: string;
}) {
  return (
    <label
      className={
        "group flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-colors " +
        (selected
          ? "border-rose-400 bg-rose-50/60 dark:border-rose-500 dark:bg-rose-950/30"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600")
      }
    >
      <input
        type="radio"
        name={name}
        value={meta.id}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 items-center justify-center rounded-md"
          style={{
            background: meta.accent + "1f",
            color: meta.accent,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={meta.iconPath} />
          </svg>
        </span>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {meta.label}
        </span>
        {selected ? (
          <span
            aria-hidden
            className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {meta.description}
      </p>
    </label>
  );
}
