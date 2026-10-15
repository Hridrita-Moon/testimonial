"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { InboxTestimonial } from "./InboxList";

/**
 * Edit modal for a single testimonial.
 *
 * PATCHes `/api/testimonials/<id>` with the same fields the
 * public submission schema validates. On 2xx we close the modal
 * and `router.refresh()` the inbox.
 *
 * The `additionalValues` field is shown as a single textarea
 * holding a JSON object. A future change can split it into three
 * inputs; for MVP this is good enough.
 */

export function EditTestimonialDialog({
  testimonial,
  onClose,
}: {
  testimonial: InboxTestimonial;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(testimonial.contributorName);
  const [email, setEmail] = useState(testimonial.contributorEmail);
  const [text, setText] = useState(testimonial.testimonialText);
  const [rating, setRating] = useState<string>(
    testimonial.rating != null ? String(testimonial.rating) : "",
  );
  const [extras, setExtras] = useState<string>(
    testimonial.additionalValues
      ? JSON.stringify(testimonial.additionalValues, null, 2)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let additionalValues: object | null = null;
    if (extras.trim().length > 0) {
      try {
        additionalValues = JSON.parse(extras);
      } catch {
        setSaving(false);
        setError("Additional values must be valid JSON.");
        return;
      }
    }

    const body: Record<string, unknown> = {
      contributorName: name,
      contributorEmail: email,
      testimonialText: text,
      additionalValues,
    };
    if (testimonial.space.ratingEnabled && rating !== "") {
      const n = Number(rating);
      if (Number.isFinite(n) && n >= 1 && n <= 5) {
        body.rating = n;
      }
    }

    try {
      const res = await fetch(`/api/testimonials/${testimonial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(data.message ?? data.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Edit testimonial
        </h2>
        <form
          onSubmit={onSubmit}
          className="mt-4 flex flex-col gap-3"
        >
          <Field id="t-name" label="Name">
            <input
              id="t-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            />
          </Field>
          <Field id="t-email" label="Email">
            <input
              id="t-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={320}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            />
          </Field>
          <Field id="t-text" label="Testimonial">
            <textarea
              id="t-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              rows={5}
              maxLength={5000}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            />
          </Field>
          {testimonial.space.ratingEnabled ? (
            <Field id="t-rating" label="Rating (1–5)">
              <select
                id="t-rating"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">No rating</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} ★
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field id="t-extras" label="Additional values (JSON)">
            <textarea
              id="t-extras"
              value={extras}
              onChange={(e) => setExtras(e.target.value)}
              rows={3}
              placeholder='{"companyName": "ACME"}'
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            />
          </Field>

          {error ? (
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
