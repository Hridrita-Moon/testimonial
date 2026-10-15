"use client";

/**
 * Client island that renders the dashboard sidebar nav.
 *
 * The shell is a server component (so it can read the user from
 * Prisma) but the nav itself needs `usePathname()` to highlight
 * the active link. We keep this client island small: just the list
 * of links + the active state. Everything else (logo, plan pill,
 * user info, sign-out) stays in the server shell.
 *
 * The Wall of Love entry is only enabled when the user has at
 * least one space (`firstSpaceSlug` is non-null); otherwise the
 * link is rendered as disabled with a tooltip.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  /** When set, the link is disabled (rendered as a non-link span). */
  disabled?: boolean;
}

export function SidebarNav({
  items,
}: {
  items: NavItem[];
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Dashboard">
      {items.map((item) => {
        const isActive =
          !item.disabled &&
          (pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) ||
            (item.href === "/dashboard" && pathname === "/dashboard"));
        const base =
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700";
        const active =
          "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";
        const inactive =
          "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";
        const disabled =
          "cursor-not-allowed text-zinc-400 dark:text-zinc-600";
        const classes = `${base} ${item.disabled ? disabled : isActive ? active : inactive}`;

        if (item.disabled) {
          return (
            <span
              key={item.href + item.label}
              className={classes}
              aria-disabled="true"
              title="Create a space first to publish a Wall of Love."
            >
              {item.label}
            </span>
          );
        }
        return (
          <Link key={item.href + item.label} href={item.href} className={classes}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
