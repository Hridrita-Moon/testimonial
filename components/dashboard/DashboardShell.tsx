/**
 * Dashboard layout shell.
 *
 * Two-column layout:
 *   - left sidebar (240px on md+, full-width top bar on small screens)
 *     contains the product brand, a Free/Premium pill, the main nav
 *     (Overview, Spaces, Inbox, Wall of Love, Settings), the user's
 *     name/email, and a sign-out button;
 *   - main content area to the right renders the page.
 *
 * Server component. The nav itself is the `SidebarNav` client island
 * so it can highlight the active link via `usePathname()`.
 *
 * The Wall of Love nav target is `/dashboard/wall-of-love` — the
 * widget manager. The manager handles the empty-state UX (one
 * card per owned space, with a "Create widget" CTA on spaces
 * that don't have one yet), so the sidebar entry is never
 * disabled. The public, unauthenticated wall stays at
 * `/p/<slug>/wall` per the PRD; the manager exposes that URL as
 * a "View public URL" button on each card.
 */

import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SidebarNav, type NavItem } from "./SidebarNav";

export function DashboardShell({
  user,
  plan,
  children,
}: {
  user: { name: string | null; email: string };
  plan: "free" | "premium";
  children: React.ReactNode;
}) {
  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/spaces", label: "Spaces" },
    { href: "/dashboard/inbox", label: "Inbox" },
    { href: "/dashboard/wall-of-love", label: "Wall of Love" },
    { href: "/dashboard/settings", label: "Settings" },
  ];

  const initials = (user.name ?? user.email).slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 md:flex-row">
      {/* Mobile top bar — collapses to a logo + sign-out on small screens. */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight text-zinc-950 transition-colors duration-200 dark:text-zinc-50"
        >
          Testimonial SaaS
        </Link>
        <SignOutButton className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600" />
      </header>

      {/* Sidebar — fixed-width on md+, full-height, sticky. */}
      <aside
        className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white md:sticky md:top-0 md:flex md:h-screen dark:border-zinc-800 dark:bg-zinc-900"
        aria-label="Dashboard sidebar"
      >
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          {/* Brand + plan pill */}
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard"
              className="text-base font-semibold tracking-tight text-zinc-950 transition-colors duration-200 dark:text-zinc-50"
            >
              Testimonial SaaS
            </Link>
            <span
              className={
                plan === "premium"
                  ? "inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:bg-amber-900/30 dark:text-amber-300"
                  : "inline-flex w-fit items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }
              aria-label={`Current plan: ${plan}`}
            >
              {plan === "premium" ? "Premium" : "Free"}
            </span>
          </div>

          {/* Main nav */}
          <SidebarNav items={navItems} />

          {/* Spacer pushes the user card to the bottom */}
          <div className="flex-1" />

          {/* User card + sign-out */}
          <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-700"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {user.name ?? user.email}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {user.email}
              </p>
            </div>
            <SignOutButton className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-600" />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:overflow-x-hidden">{children}</main>
    </div>
  );
}
