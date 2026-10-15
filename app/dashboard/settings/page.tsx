import { Suspense } from "react";
import { SettingsContent } from "./SettingsContent";

/**
 * `/dashboard/settings` — synchronous server component shell.
 *
 * The page itself is a static shell: the "Settings" heading
 * and a subhead. The account and plan cards live in
 * `SettingsContent`, an async server component that runs inside
 * a `<Suspense>` boundary and streams in once the session + DB
 * reads resolve.
 *
 * This split is what fixes the "instant navigation dropped
 * segment" warning. Without it, the top-level `await auth()`
 * parks the page inside an implicit Suspense with no
 * fallback, which Next 16's cacheComponents pipeline drops
 * from its instant-UI cache.
 */

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Account and plan information.
        </p>
      </header>

      <Suspense fallback={<SettingsContentFallback />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

function SettingsContentFallback() {
  return (
    <>
      <div className="h-48 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" />
      <div className="mt-6 h-64 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" />
    </>
  );
}
