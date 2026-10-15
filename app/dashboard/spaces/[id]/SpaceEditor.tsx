"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * Client editor for one of the owner's spaces.
 *
 * PATCHes `/api/spaces/<id>` on save and DELETEs the same route
 * on the delete button (with a `confirm()`). On a successful
 * delete we navigate back to the spaces list. On a successful
 * save we `router.refresh()` so the recent activity list and the
 * list page pick up the new title/slug.
 *
 * The three core fields are intentionally not editable — they
 * are always required + enabled. The chips at the bottom of the
 * form make that explicit.
 */

interface SpaceEditorProps {
  space: {
    id: string;
    title: string;
    subtitle: string | null;
    prompt: string;
    theme: "light" | "dark";
    ratingEnabled: boolean;
    publicSlug: string;
    enabledFields: {
      companyName: boolean;
      socialLinks: boolean;
      profilePhoto: boolean;
    };
  };
}

export function SpaceEditor({ space }: SpaceEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(space.title);
  const [subtitle, setSubtitle] = useState(space.subtitle ?? "");
  const [prompt, setPrompt] = useState(space.prompt);
  const [theme, setTheme] = useState<"light" | "dark">(space.theme);
  const [ratingEnabled, setRatingEnabled] = useState(space.ratingEnabled);
  const [publicSlug, setPublicSlug] = useState(space.publicSlug);
  const [enabledFields, setEnabledFields] = useState(space.enabledFields);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/spaces/${space.publicSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle,
          prompt,
          theme,
          ratingEnabled,
          publicSlug,
          enabledFields,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { publicSlug: string };
      setPublicSlug(data.publicSlug);
      setMessage({ kind: "ok", text: "Saved." });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (
      !confirm(
        `Delete this space and its ${"testimonials"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/spaces/${space.publicSlug}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      router.push("/dashboard/spaces");
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={onSave}
      className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <Field
        id="title"
        label="Title"
        value={title}
        onChange={setTitle}
        required
      />
      <Field
        id="subtitle"
        label="Subtitle"
        value={subtitle}
        onChange={setSubtitle}
        placeholder="Optional"
      />
      <Field
        id="prompt"
        label="Collection prompt"
        value={prompt}
        onChange={setPrompt}
        required
        multiline
      />
      <Field
        id="publicSlug"
        label="Public URL slug"
        value={publicSlug}
        onChange={(v) =>
          setPublicSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))
        }
        hint="Lowercase letters, numbers, and hyphens only. A 4-char suffix is appended on collision."
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Theme
        </legend>
        <div className="flex gap-3 text-sm">
          {(["light", "dark"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input
                type="radio"
                name="theme"
                value={t}
                checked={theme === t}
                onChange={() => setTheme(t)}
              />
              <span className="capitalize">{t}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
        <input
          type="checkbox"
          checked={ratingEnabled}
          onChange={(e) => setRatingEnabled(e.target.checked)}
        />
        Enable star ratings (1–5) on the public form
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Optional fields
        </legend>
        {(
          [
            ["companyName", "Company name"],
            ["socialLinks", "Social profile links"],
            ["profilePhoto", "Profile photo URL"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <input
              type="checkbox"
              checked={enabledFields[key]}
              onChange={(e) =>
                setEnabledFields((p) => ({ ...p, [key]: e.target.checked }))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          name (required)
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          email (required)
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          testimonial (required)
        </span>
      </div>

      {message ? (
        <p
          role="alert"
          className={
            message.kind === "ok"
              ? "text-sm text-emerald-700 dark:text-emerald-400"
              : "text-sm text-red-700 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="submit"
          disabled={saving || deleting}
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={saving || deleting}
          className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          {deleting ? "Deleting…" : "Delete space"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
  placeholder,
  hint,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        {label}
        {required ? (
          <span className="ml-1 text-red-600" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={4}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="rounded-md border border-zinc-300 bg-white p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      ) : (
        <input
          id={id}
          type="text"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="rounded-md border border-zinc-300 bg-white p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      )}
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
