"use client";

/**
 * Sign-in form (client island).
 *
 * Uses Auth.js v5's `signIn` from `next-auth/react`. We pass
 * `redirect: false` so the form controls navigation (preserves the
 * `next` redirect target, lets us surface inline error messages).
 *
 * The `next` query-param is read via `useSearchParams()` so the
 * page can render the form in its static shell — the previous
 * shape (server-side `await searchParams` + prop-drill) parked
 * the form inside an implicit Suspense that the client could not
 * hydrate until the streaming chunk arrived, producing a blank
 * screen for the user.
 *
 * Auth.js deliberately does not distinguish "unknown email" from
 * "wrong password" — both return the same 401. The sign-in copy
 * reflects that: we never say "user not found".
 */

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

/**
 * Whitelist the next-param to an internal path to avoid
 * open-redirect. Duplicated from the previous server-side
 * `safeNext` so the form works in isolation if extracted.
 */
function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams?.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setError("Invalid email or password.");
        setSubmitting(false);
        return;
      }
      router.push(next ?? "/dashboard");
      router.refresh();
    } catch {
      // Network/transport failure — surface as an inline error and
      // re-enable the form. The signIn() call above does not
      // throw on a 401; it returns `{ error }`.
      setError("Sign-in failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="email"
          className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white p-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white p-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
