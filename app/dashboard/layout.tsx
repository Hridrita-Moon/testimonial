import { Suspense } from "react";
import { DashboardShellFallback } from "@/components/dashboard/DashboardShellFallback";
import { DashboardLayoutData } from "./DashboardLayoutData";

/**
 * `/dashboard/*` layout.
 *
 * The outer layout is a synchronous server component. It does
 * not call `await auth()` or any other dynamic API at the top
 * level — that means Next 16 can treat the static chrome (the
 * sidebar layout, the brand mark, the plan pill placeholder,
 * the page wrapper) as a static fragment eligible for partial
 * prerendering.
 *
 * The user-specific bits (real name, real email, real plan
 * pill, the active-link-aware `SidebarNav`) live in
 * `DashboardLayoutData`, an async server component imported
 * below. That component is wrapped in `<Suspense>` with
 * `DashboardShellFallback` as the fallback. While the DB read
 * is in flight, the user sees the chrome with skeleton
 * placeholders; when the read resolves, the real shell streams
 * in and replaces the fallback.
 *
 * Why this matters: with the previous shape (the layout
 * itself was an `async` function with a top-level `await
 * auth()`), Next 16 had no way to derive a static shell
 * before the `auth()` call resolved, so the entire
 * `/dashboard` tree was implicitly dynamic. The
 * cacheComponents pipeline then dropped the segment from its
 * instant-UI cache with the "instant navigation dropped
 * segment" warning. Splitting the layout into a sync outer +
 * async inner + Suspense boundary gives Next a concrete
 * static shell to cache, which is what makes the warning go
 * away and lets the page be prefetched.
 *
 * The fallback does NOT render `DashboardShell` (with its
 * `SidebarNav` client island) because `SidebarNav` uses
 * `usePathname()` to highlight the active link, and Next 16
 * refuses to prerender that hook in a fallback path. The
 * fallback uses `DashboardShellFallback`, which is the same
 * shell minus the nav — the nav streams in once the real
 * shell resolves.
 *
 * The proxy still gates this path behind an authenticated
 * session; the inner component's auth check is a
 * belt-and-braces guard for stale cookies.
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardShellFallback>{children}</DashboardShellFallback>}>
      <DashboardLayoutData>{children}</DashboardLayoutData>
    </Suspense>
  );
}
