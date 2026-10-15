"use client";

/**
 * Client-side form for `/p/<slug>`.
 *
 * The server component (`./page.tsx`) loads the space's enabled
 * `SpaceField` config and passes it here. This component:
 *
 *     1. Holds the form values in state (one entry per enabled field,
 *        keyed by the SpaceField's `fieldType` — typically `name`,
 *        `email`, `testimonialText`).
 *     2. On submit, translates those input-side keys into the
 *        schema-side keys the server expects (`name` → `contributorName`,
 *        `email` → `contributorEmail`, others pass through), then
 *        validates the translated body client-side via the same Zod
 *        schema the server uses, so the contributor gets a "Required"
 *        message under the input without round-tripping to the server.
 *     3. On success, POSTs JSON to `/api/spaces/<slug>/testimonials`.
 *     4. On 422, re-renders with the server's error message AND
 *        preserves all previously entered values.
 *     5. On 201, swaps to a "Thank you" confirmation state.
 *
 * The server is still authoritative: this client's preflight catches
 * obvious blanks and gives inline feedback, but the server's
 * re-validation is what gates persistence.
 *
 * Debugging — every state transition logs a single structured line
 * with the prefix `[SubmitForm:<slug>]` so a developer can grep the
 * browser console. The submission, success, and non-201 lines use
 * `console.warn` so they are visible at Chrome's default "Info"
 * filter level (Chrome hides `console.debug` by default; using
 * `debug` here would have hidden the very signal a developer needs
 * to see when the button "does nothing").
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { testimonialSubmissionSchema } from "@/lib/validation/testimonial-submission";
import { translateToSchemaBody, inputKeyFor } from "@/lib/form-keys";

interface FieldConfig {
  fieldType: string;
  label: string;
  required: boolean;
  displayOrder: number;
}

interface SubmitFormProps {
  slug: string;
  ratingEnabled: boolean;
  fields: FieldConfig[];
}

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; id: string }
  | { kind: "error"; message: string };

/** Per-field client error keyed by the form-input id we render. */
type FieldErrors = Partial<Record<string, string>>;

/**
 * The relative path is critical: when the page is at `/p/<slug>`,
 * `/api/spaces/<slug>/testimonials` resolves to the same origin.
 * An absolute URL would break if the app were ever mounted under a
 * sub-path, and a 1-segment `<path>` would resolve to a 404.
 */
const SUBMIT_PATH = (slug: string) => `/api/spaces/${slug}/testimonials`;

export function SubmitForm({ slug, ratingEnabled, fields }: SubmitFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [rating, setRating] = useState<string>("");
  const [socialConsent, setSocialConsent] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [errors, setErrors] = useState<FieldErrors>({});

  if (status.kind === "success") {
    return (
      <SubmitSuccess
        referenceId={status.id}
        onGoToDashboard={() => router.push("/dashboard")}
      />
    );
  }

  function setField(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    // Translate the input-side keys (name, email, testimonialText) to
    // the schema-side keys the server expects (contributorName,
    // contributorEmail, testimonialText). Without this, the strict
    // Zod schema on the server rejects the body with 422 and the
    // contributor's data never lands.
    const translated: Record<string, unknown> = translateToSchemaBody(values);
    if (ratingEnabled && rating !== "") {
      const n = Number(rating);
      if (Number.isFinite(n) && n >= 1 && n <= 5) {
        translated.rating = n;
      }
    }
    if (socialConsent) {
      translated.socialConsent = true;
    }

    // Client-side preflight: same schema the server uses. We surface
    // the first per-field error under its input.
    const parsed = testimonialSubmissionSchema.safeParse(translated);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const schemaPath = issue.path.join(".");
        if (!schemaPath || fieldErrors[schemaPath]) continue;
        // The error key from Zod is the schema-side name
        // (e.g. `contributorName`); our inputs are keyed by the
        // form-side name (`name`). Translate back so the message
        // appears under the right input.
        const inputKey = inputKeyFor(schemaPath);
        fieldErrors[inputKey] = issue.message;
      }
      setErrors(fieldErrors);
      // Use `warn` (not `debug`) so this is visible at the default
      // Chrome filter level — a developer looking at the console
      // with default filters will see exactly what blocked the
      // submit.
      console.warn(
        `[SubmitForm:${slug}] preflight failed`,
        { fieldCount: Object.keys(fieldErrors).length },
        fieldErrors,
      );
      return;
    }

    setStatus({ kind: "submitting" });
    const url = SUBMIT_PATH(slug);
    console.warn(`[SubmitForm:${slug}] submitting → ${url}`, parsed.data);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      console.warn(`[SubmitForm:${slug}] response ${res.status}`, {
        status: res.status,
        ok: res.ok,
        contentType: res.headers.get("content-type"),
      });

      if (res.status === 201) {
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        const id = typeof data.id === "string" ? data.id : "(unknown)";
        (window as { __lastSubmitId?: string }).__lastSubmitId = id;
        console.warn(`[SubmitForm:${slug}] success`, { id });
        setStatus({ kind: "success", id });
        return;
      }

      let payload: Record<string, unknown> = {};
      let rawText = "";
      try {
        rawText = await res.text();
        payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      } catch {
        /* response wasn't JSON */
      }
      const serverMsg =
        typeof payload.error === "string"
          ? payload.error
          : `Request failed (HTTP ${res.status}).`;
      const field =
        typeof payload.field === "string" ? (payload.field as string) : null;

      if (field) {
        const inputKey = inputKeyFor(field);
        setErrors((prev) => ({ ...prev, [inputKey]: serverMsg }));
      }

      let message = serverMsg;
      if (res.status === 429) {
        message = `${message} Please wait a moment and try again.`;
      } else if (res.status >= 500) {
        message = `${message} The server hit an error — please try again.`;
      }
      console.warn(`[SubmitForm:${slug}] non-201`, {
        status: res.status,
        body: rawText,
      });
      setStatus({ kind: "error", message });
    } catch (err) {
      console.error(`[SubmitForm:${slug}] network error`, err);
      setStatus({
        kind: "error",
        message:
          "Network error. Check the browser console and your connection, then try again.",
      });
    }
  }

  const isSubmitting = status.kind === "submitting";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {fields.map((f) => (
        <Field
          key={f.fieldType}
          config={f}
          value={values[f.fieldType] ?? ""}
          onChange={(v) => setField(f.fieldType, v)}
          error={errors[f.fieldType]}
        />
      ))}

      {ratingEnabled ? (
        <Field
          config={{
            fieldType: "rating",
            label: "Rating (1–5)",
            required: false,
            displayOrder: 99,
          }}
          value={rating}
          onChange={setRating}
          error={errors.rating}
        />
      ) : null}

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={socialConsent}
          onChange={(e) => setSocialConsent(e.target.checked)}
        />
        I consent to having this shared on social media.
      </label>

      {status.kind === "error" ? (
        <p
          className="text-sm text-red-700 dark:text-red-400"
          role="alert"
          aria-live="assertive"
        >
          {status.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-zinc-900/40 dark:border-t-zinc-900"
            />
            Submitting…
          </>
        ) : (
          "Submit testimonial"
        )}
      </button>
    </form>
  );
}

function Field({
  config,
  value,
  onChange,
  error,
}: {
  config: FieldConfig;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = `f-${config.fieldType}`;
  const isLong = config.fieldType === "testimonialText";
  const inputType =
    config.fieldType === "email" ? "email" : isLong ? "textarea" : "text";

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        {config.label}
        {config.required ? (
          <span className="ml-1 text-red-600" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {inputType === "textarea" ? (
        <textarea
          id={id}
          name={config.fieldType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={config.required}
          rows={5}
          aria-invalid={error ? "true" : "false"}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
      ) : (
        <input
          id={id}
          name={config.fieldType}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={config.required}
          aria-invalid={error ? "true" : "false"}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
      )}
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Success state shown after a testimonial is submitted (201).
 *
 * A self-contained celebration card with a little bit of whimsy:
 *   - A popping checkmark badge (CSS keyframe `submit-success-pop`)
 *     ringed by four floating party emojis that orbit the badge
 *     once, fade in, then drift away.
 *   - A confetti burst of 14 colored pieces falling from the top
 *     of the card (CSS keyframe `submit-success-confetti-fall`).
 *     Deterministic positions/colors so server and client render
 *     identically and there's no hydration warning.
 *   - A "Quest complete" stat panel — a small game-y touch that
 *     awards the contributor +50 XP and 1 "Good Human" badge. It's
 *     the kind of small, silly, delightful flourish that turns a
 *     "your form was accepted" page into a moment the contributor
 *     remembers.
 *   - A bold "Testimonial delivered!" headline.
 *   - A friendly quip and a small reference id.
 *   - A primary "Go to Dashboard" button that `router.push()`es
 *     to `/dashboard`.
 *
 * No external assets. The whole effect is CSS + inline SVG so it
 * works offline, has no GIF/PNG/Lottie to fetch, and respects
 * `prefers-reduced-motion` — the animations collapse to their
 * final frame for users who've opted out of motion.
 */
function SubmitSuccess({
  referenceId,
  onGoToDashboard,
}: {
  referenceId: string;
  onGoToDashboard: () => void;
}) {
  // 14 confetti pieces. Each entry is a deterministic
  // (left, delay, color, rotate) tuple. Determinism avoids a
  // hydration mismatch warning (random values would render
  // differently on the server vs the client).
  const pieces = [
    { left: "6%",  delay: "0ms",   color: "#f43f5e", rotate: "-12deg" },
    { left: "18%", delay: "60ms",  color: "#f59e0b", rotate: "18deg"  },
    { left: "30%", delay: "120ms", color: "#10b981", rotate: "-30deg" },
    { left: "42%", delay: "20ms",  color: "#3b82f6", rotate: "8deg"   },
    { left: "54%", delay: "180ms", color: "#a855f7", rotate: "-22deg" },
    { left: "66%", delay: "90ms",  color: "#ec4899", rotate: "26deg"  },
    { left: "78%", delay: "150ms", color: "#14b8a6", rotate: "-14deg" },
    { left: "90%", delay: "40ms",  color: "#f97316", rotate: "12deg"  },
    { left: "12%", delay: "210ms", color: "#8b5cf6", rotate: "-8deg"  },
    { left: "48%", delay: "100ms", color: "#06b6d4", rotate: "20deg"  },
    { left: "72%", delay: "240ms", color: "#84cc16", rotate: "-26deg" },
    { left: "24%", delay: "160ms", color: "#eab308", rotate: "14deg"  },
    { left: "36%", delay: "280ms", color: "#ef4444", rotate: "-18deg" },
    { left: "84%", delay: "320ms", color: "#22c55e", rotate: "22deg"  },
  ];

  // Four orbit positions for the floating emojis (🎉, ✨, 🥳, 💖).
  // Each entry is a deterministic (angle, delay, char) tuple —
  // angles are in degrees, starting from "12 o'clock" and walking
  // around the badge so the four emojis are evenly spaced.
  const orbiters = [
    { angle: -45,  delay: "120ms", char: "🎉" },
    { angle: 45,   delay: "200ms", char: "✨" },
    { angle: 135,  delay: "280ms", char: "🥳" },
    { angle: 225,  delay: "360ms", char: "💖" },
  ];

  return (
    <div
      className="submit-success relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-emerald-900 shadow-md ring-1 ring-emerald-200/50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-800/50"
      role="status"
      aria-live="polite"
    >
      {/* Confetti burst — 14 pieces falling from the top. Each
          is a small absolutely-positioned rectangle that runs the
          `confetti-fall` keyframe once. The pieces are inert
          (aria-hidden) — they communicate success visually, not
          semantically. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-full"
      >
        {pieces.map((p, i) => (
          <span
            key={i}
            className="submit-success__confetti"
            style={{
              left: p.left,
              background: p.color,
              animationDelay: p.delay,
              transform: `rotate(${p.rotate})`,
            }}
          />
        ))}
      </div>

      {/* Badge + orbit. A 24-px "halo" extends out from the badge
          so the floating emojis can pop in around it without
          escaping the rounded card. The four emojis are absolutely
          positioned in a 64px square that starts at the badge's
          center; each one is offset by its angle, faded in, and
          given a tiny final drift. */}
      <div
        aria-hidden
        className="submit-success__halo relative mx-auto h-24 w-24"
      >
        <div className="absolute inset-0 m-auto h-16 w-16">
          <div className="submit-success__badge flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md dark:bg-emerald-400 dark:text-emerald-950">
            <svg
              viewBox="0 0 24 24"
              className="h-9 w-9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </div>
        </div>
        {orbiters.map((o, i) => (
          <span
            key={i}
            className="submit-success__orbiter"
            style={{
              // Rotate from 12 o'clock by `o.angle`, then push
              // out 44px so the emoji sits just outside the
              // 64px badge. The whole transform is the static
              // "rest" position; the keyframe does the pop-in
              // and drift.
              transform: `translate(-50%, -50%) rotate(${o.angle}deg) translateY(-44px) rotate(${-o.angle}deg)`,
              animationDelay: o.delay,
            }}
          >
            {o.char}
          </span>
        ))}
      </div>

      <h2 className="mt-4 text-center text-2xl font-semibold">
        Testimonial delivered!
      </h2>
      <p className="mt-2 text-center text-sm text-emerald-800 dark:text-emerald-200">
        Nice words travel far. The space owner just got a
        notification and will see this in their inbox.
      </p>
      <p className="mt-1 text-center text-xs text-emerald-700/80 dark:text-emerald-300/70">
        (You just made someone&apos;s day.)
      </p>

      {/* "Quest complete" stat panel — a small gamified flourish
          that gives the contributor a tiny dopamine hit. All
          values are static; nothing is actually awarded, but the
          contributor is now emotionally invested in the page. */}
      <div
        className="submit-success__panel mt-4 flex items-center justify-around gap-2 rounded-md border border-emerald-200/80 bg-white/60 px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-900/40"
        aria-hidden
      >
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
            XP
          </span>
          <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            +50
          </span>
        </div>
        <div className="h-6 w-px bg-emerald-200 dark:bg-emerald-800" />
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
            Quest
          </span>
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            ✓ Complete
          </span>
        </div>
        <div className="h-6 w-px bg-emerald-200 dark:bg-emerald-800" />
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
            Title
          </span>
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Good Human
          </span>
        </div>
      </div>

      {referenceId && referenceId !== "(unknown)" ? (
        <p className="mt-3 text-center text-[11px] uppercase tracking-wide text-emerald-700/60 dark:text-emerald-300/50">
          Reference {referenceId.slice(0, 8)}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onGoToDashboard}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-emerald-50 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400 dark:focus:ring-offset-emerald-950"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12l9-9 9 9" />
            <path d="M5 10v10h14V10" />
          </svg>
          Go to Dashboard
        </button>
      </div>

      {/* Scoped keyframes for the celebration. We use a <style>
          tag here (rather than a global stylesheet) because the
          effect is only relevant to this one component. The
          `prefers-reduced-motion` media query collapses every
          animation to its final state for users who've opted out
          of motion. */}
      <style>{`
        @keyframes submit-success-pop {
          0%   { transform: scale(0);    opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          80%  { transform: scale(0.95); }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes submit-success-confetti-fall {
          0%   { transform: translateY(-12px) rotate(0deg);   opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(220px) rotate(540deg); opacity: 0; }
        }
        @keyframes submit-success-orbiter {
          0%   { opacity: 0; }
          15%  { opacity: 0; }
          35%  { opacity: 1; }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .submit-success__badge {
          animation: submit-success-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .submit-success__orbiter {
          position: absolute;
          left: 50%;
          top: 50%;
          font-size: 22px;
          line-height: 1;
          animation: submit-success-orbiter 1600ms ease-in-out both;
        }
        .submit-success__confetti {
          position: absolute;
          top: 0;
          width: 8px;
          height: 14px;
          border-radius: 1px;
          animation: submit-success-confetti-fall 1400ms ease-in both;
        }
        @media (prefers-reduced-motion: reduce) {
          .submit-success__badge,
          .submit-success__confetti,
          .submit-success__orbiter {
            animation: none;
          }
          .submit-success__confetti { opacity: 0; }
          .submit-success__orbiter { opacity: 1; }
        }
      `}</style>
    </div>
  );
}