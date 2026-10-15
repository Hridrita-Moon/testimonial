import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPremium } from "@/lib/plan-limits";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { RedirectToSignIn } from "@/components/auth/RedirectToSignIn";

/**
 * Dynamic inner of `/dashboard/layout.tsx`.
 *
 * The outer layout is a synchronous server component that renders
 * a `<Suspense>` boundary with a skeleton shell as the fallback
 * (see `app/dashboard/layout.tsx` for the rationale). This inner
 * component runs inside that Suspense, performs the `await auth()`
 * and `await prisma.user.findUnique(...)` reads, and then renders
 * the real shell with the user's name, email, and plan flag.
 *
 * Splitting the layout this way lets Next 16's PPR pipeline
 * stream the static shell (the sidebar nav, the mobile top bar,
 * the page chrome) in the initial response, and stream the
 * user-specific values (name, email, plan pill) in once the DB
 * read resolves. The "instant navigation dropped segment"
 * warning was caused by the layout's top-level `await` parking
 * the whole tree behind an implicit Suspense with no fallback,
 * which Next 16 then dropped from its instant-UI cache because
 * the shell could not be derived before the read resolved.
 *
 * The auth check is still belt-and-braces — the proxy already
 * gates this path, so reaching this component unauthenticated
 * is rare (e.g. a stale cookie). When it happens, we render the
 * `<RedirectToSignIn />` island, which the client navigates
 * to `/sign-in?next=/dashboard` on the next paint.
 */
export async function DashboardLayoutData({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    return <RedirectToSignIn next="/dashboard" />;
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      subscriptions: { select: { plan: true } },
    },
  });
  // Defensive: the session id should always resolve. If it does
  // not, treat as unauthenticated.
  if (!user) {
    return <RedirectToSignIn next="/dashboard" />;
  }

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email }}
      plan={isPremium(user.subscriptions?.[0]?.plan) ? "premium" : "free"}
    >
      {children}
    </DashboardShell>
  );
}
