import { auth } from "@/lib/auth";
import { getLimitsForPlan, isPremium } from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";
import { NewSpaceForm } from "./NewSpaceForm";

/**
 * Dynamic inner of `/dashboard/spaces/new/page.tsx`.
 *
 * Reads the user's plan and current space count to render the
 * "X of Y slots remaining" hint. The form itself is a client
 * island. The plan-limit gate is enforced on submit via
 * `assertCanCreateSpace`; we also surface a soft hint on this
 * page so the user sees their remaining slots before
 * submitting.
 *
 * Runs inside a `<Suspense>` boundary owned by the page.
 */
export async function NewSpaceContent() {
  const session = await auth();
  if (!session?.user) return null;
  const userId = session.user.id;

  const [sub, spacesUsed] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId },
      select: { plan: true },
    }),
    prisma.space.count({ where: { ownerId: userId } }),
  ]);

  const plan = isPremium(sub?.plan) ? "premium" : "free";
  const limits = getLimitsForPlan(plan);
  const remaining = Math.max(0, limits.maxSpaces - spacesUsed);

  return (
    <>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        A space is a single testimonial collection page with its
        own public link. You have {remaining} of {limits.maxSpaces}{" "}
        {limits.maxSpaces > 1 ? "slots" : "slot"} remaining on the{" "}
        {plan === "premium" ? "Premium" : "Free"} plan.
      </p>
      <div className="mt-6">
        <NewSpaceForm />
      </div>
    </>
  );
}
