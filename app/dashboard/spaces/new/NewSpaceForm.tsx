"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * New-space form (client island).
 *
 * Posts to `/api/spaces`. On 201 the server returns `{ id,
 * publicSlug }` and we navigate to the post-create success screen
 * at `/dashboard/spaces/<id>/created`. The success screen shows
 * the public URL with a copy button.
 *
 * Plan-limit errors come back as 403 with a `max_spaces` code;
 * the user sees an inline message and is pointed to /billing.
 */

interface FormState {
  title: string;
  subtitle: string;
  prompt: string;
  theme: "light" | "dark";
  ratingEnabled: boolean;
  publicSlug: string;
  enabledFields: {
    companyName: boolean;
    socialLinks: boolean;
    profilePhoto: boolean;
  };
}

const INITIAL: FormState = {
  title: "",
  subtitle: "",
  prompt: "",
  theme: "light",
  ratingEnabled: true,
  publicSlug: "",
  enabledFields: {
    companyName: false,
    socialLinks: false,
    profilePhoto: false,
  },
};

export function NewSpaceForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function updateField<K extends keyof FormState["enabledFields"]>(
    key: K,
    value: boolean,
  ) {
    setForm((prev) => ({
      ...prev,
      enabledFields: { ...prev.enabledFields, [key]: value },
    }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setField(null);

    let res: Response;
    try {
      res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } catch {
      setSubmitting(false);
      setError("Network error. Please try again.");
      return;
    }

    if (res.status === 201) {
      const data = (await res.json()) as { id: string; publicSlug: string };
      router.push(`/dashboard/spaces/${data.id}/created`);
      return;
    }

    setSubmitting(false);
    let message = "Could not create space.";
    try {
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        field?: string;
        code?: string;
      };
      if (data.code === "max_spaces") {
        message = `${data.error ?? "Plan limit reached."} Upgrade your plan for more spaces.`;
      } else if (data.message) {
        message = data.message;
      } else if (data.error) {
        message = data.error;
      }
      if (data.field) setField(data.field);
    } catch {
      /* non-JSON */
    }
    setError(message);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <Field
        id="title"
        label="Title"
        required
        value={form.title}
        onChange={(v) => update("title", v)}
        placeholder="e.g. Product Hunt reviews"
        error={field === "title" ? error : null}
      />
      <Field
        id="subtitle"
        label="Subtitle (optional)"
        value={form.subtitle}
        onChange={(v) => update("subtitle", v)}
        placeholder="A short line under the title"
      />
      <Field
        id="prompt"
        label="Collection prompt"
        required
        value={form.prompt}
        onChange={(v) => update("prompt", v)}
        placeholder="What would you like contributors to share?"
        multiline
        error={field === "prompt" ? error : null}
      />
      <Field
        id="publicSlug"
        label="Public URL slug (optional)"
        value={form.publicSlug}
        onChange={(v) =>
          update(
            "publicSlug",
            v.toLowerCase().replace(/[^a-z0-9-]/g, ""),
          )
        }
        placeholder="auto-generated from title"
        hint="Lowercase letters, numbers, and hyphens only. Leave blank to auto-generate."
        error={field === "publicSlug" ? error : null}
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
                checked={form.theme === t}
                onChange={() => update("theme", t)}
              />
              <span className="capitalize">{t}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
        <input
          type="checkbox"
          checked={form.ratingEnabled}
          onChange={(e) => update("ratingEnabled", e.target.checked)}
        />
        Enable star ratings (1–5) on the public form
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Optional fields
        </legend>
        <p className="text-xs text-zinc-500">
          Name, email, and testimonial are always collected. Toggle the
          optional fields on if you want to ask for them.
        </p>
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
              checked={form.enabledFields[key]}
              onChange={(e) => updateField(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {error && !field ? (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
        >
          {submitting ? "Creating…" : "Create space"}
        </button>
        <Link
          href="/dashboard/spaces"
          className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline hover:text-zinc-950 transition-colors duration-150 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  value,
  onChange,
  placeholder,
  hint,
  multiline,
  error,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  error?: string | null;
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
          name={id}
          rows={4}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? "true" : "false"}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
      ) : (
        <input
          id={id}
          name={id}
          type="text"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? "true" : "false"}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
      )}
      {hint && !error ? (
        <p className="text-xs text-zinc-500">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
