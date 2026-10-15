"use client";

/**
 * Sign-up form (client island).
 *
 * Two-step on success:
 *   1. POST to `/api/auth/register` to create the `User` row.
 *   2. Call `signIn("credentials", { email, password })` so the
 *      user gets a session cookie immediately and lands on the
 *      dashboard.
 *
 * We don't auto-sign-in on the server because Auth.js's
 * `signIn` server action is the single source of truth for
 * "user is signed in" — running it twice (once for register, once
 * for sign-in) keeps the JWT path consistent.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function SignUpForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setField(null);

    let res: Response;
    try {
      res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
    } catch {
      setSubmitting(false);
      setError("Network error. Please try again.");
      return;
    }

    if (res.status === 201) {
      // Auto-sign-in with the credentials the user just entered.
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      setSubmitting(false);
      if (!result || result.error) {
        setError(
          "Account created, but sign-in failed. Please sign in manually.",
        );
        return;
      }
      router.push(next ?? "/dashboard");
      router.refresh();
      return;
    }

    setSubmitting(false);
    let message = "Could not create account.";
    try {
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        field?: string;
        code?: string;
      };
      if (data.code === "duplicate_email") {
        message = "An account with that email already exists.";
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field
        id="name"
        label="Name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={setName}
        error={field === "name" ? error : null}
      />
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={field === "email" ? error : null}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        hint="At least 8 characters."
        error={field === "password" ? error : null}
      />
      {error && !field ? (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100"
      >
        {submitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  hint,
  error,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? "true" : "false"}
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />
      {hint && !error ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
