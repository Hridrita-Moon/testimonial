/**
 * Static fallback for the dashboard shell, used as the
 * `<Suspense fallback={...}>` for `/dashboard/layout.tsx`.
 *
 * Mirrors the layout of `DashboardShell` so the page doesn't
 * jump as the dynamic inner resolves — same two-column grid,
 * same padding, same brand placement. The user card is
 * skeleton (no name/email yet), the plan pill is set to
 * "Free" by default, and the main nav is replaced with a
 * vertical stack of skeleton placeholders.
 *
 * Crucially, this component does NOT render `SidebarNav` — the
 * nav uses `usePathname()` to highlight the active link, which
 * is a runtime-only value that cannot be evaluated during
 * prerendering. Next 16's cacheComponents pipeline rejects
 * `usePathname()` calls in the fallback path of a `<Suspense>`
 * with the message "URL data `usePathname()` in a Client
 * Component outside of `<Suspense>`". Hiding the nav in the
 * fallback (replaced by 5 skeleton rows) sidesteps the
 * prerender check; the real `SidebarNav` streams in once
 * `DashboardLayoutData` resolves.
 */

import Link from "next/link";

export function DashboardShellFallback({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 md:flex-row">
      {/* Mobile top bar — static */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
        >
          Testimonial SaaS
        </Link>
      </header>

      {/* Sidebar — static chrome, skeleton nav */}
      <aside
        className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white md:sticky md:top-0 md:flex md:h-screen dark:border-zinc-800 dark:bg-zinc-900"
        aria-label="Dashboard sidebar"
      >
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
          {/* Brand + plan pill (static) */}
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard"
              className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
            >
              Testimonial SaaS
            </Link>
            <span
              className="inline-flex w-fit items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              aria-label="Current plan: Free"
            >
              Free
            </span>
          </div>

          {/* Nav skeleton — 5 rows matching the real nav items */}
          <nav className="flex flex-col gap-1" aria-label="Dashboard">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-8 rounded-md bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User card skeleton */}
          <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:overflow-x-hidden">{children}</main>
    </div>
  );
}
