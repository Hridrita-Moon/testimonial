/**
 * Plan-limit enforcement for mutations that consume plan-bounded
 * resources: creating a `Space`, or accepting a new `Testimonial`
 * into an existing `Space`.
 *
 * Per `data-model.md` §10:
 *   - Limits are plan-scoped. A user with no `Subscription` row is
 *     treated as `plan = 'free'`, `status = 'active'`.
 *   - The check is "would this action land us at or above the limit?",
 *     not "is current count over?". A Premium user with 10 spaces
 *     who downgrades to Free (3 max) can still edit/delete; they
 *     just cannot create a 4th.
 *   - The functions throw a typed `PlanLimitError` on reject. The
 *     route handler converts that to a 422 response with a
 *     caller-friendly message.
 *
 * The shared plan table lives in `lib/plan-limits.ts`; this module
 * is the enforcement seam, not the data.
 */

import { prisma } from "@/lib/prisma";
import { getLimitsForPlan, isPremium } from "@/lib/plan-limits";

/**
 * Thrown when an action would exceed the owner's plan limit. The
 * route handler maps this to a 422 response.
 */
export class PlanLimitError extends Error {
  readonly code: "max_spaces" | "max_testimonials_per_space";
  readonly limit: number;
  readonly current: number;
  readonly plan: "free" | "premium";

  constructor(
    code: "max_spaces" | "max_testimonials_per_space",
    message: string,
    limit: number,
    current: number,
    plan: "free" | "premium",
  ) {
    super(message);
    this.name = "PlanLimitError";
    this.code = code;
    this.limit = limit;
    this.current = current;
    this.plan = plan;
  }
}

/**
 * Resolve a user's effective plan. A user with no `Subscription`
 * row is `free` (data-model §10). A user with a `Subscription` row
 * in any state is read directly; we don't downgrade on `past_due`
 * here because the Stripe webhook is the single source of truth
 * for `plan` flips.
 */
async function resolvePlan(userId: string): Promise<"free" | "premium"> {
  const sub = await prisma.subscription.findFirst({
    where: { userId },
    select: { plan: true },
  });
  return isPremium(sub?.plan) ? "premium" : "free";
}

/**
 * Reject if the user already owns `maxSpaces` spaces for their plan.
 */
export async function assertCanCreateSpace(userId: string): Promise<void> {
  const plan = await resolvePlan(userId);
  const limit = getLimitsForPlan(plan).maxSpaces;
  const current = await prisma.space.count({ where: { ownerId: userId } });
  if (current >= limit) {
    throw new PlanLimitError(
      "max_spaces",
      `Your ${plan} plan allows up to ${limit} spaces; you already have ${current}.`,
      limit,
      current,
      plan,
    );
  }
}

/**
 * Reject if the target space already has `maxTestimonialsPerSpace`
 * testimonials for its owner's plan.
 */
export async function assertCanSubmitTestimonial(
  spaceId: string,
): Promise<void> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { ownerId: true },
  });
  if (!space) {
    // Caller error: the route handler resolves the space first and
    // 404s before reaching here. We still defend with a typed error.
    throw new Error(`assertCanSubmitTestimonial: space ${spaceId} not found`);
  }
  const plan = await resolvePlan(space.ownerId);
  const limit = getLimitsForPlan(plan).maxTestimonialsPerSpace;
  const current = await prisma.testimonial.count({ where: { spaceId } });
  if (current >= limit) {
    throw new PlanLimitError(
      "max_testimonials_per_space",
      `This space is at the ${plan}-plan limit of ${limit} testimonials.`,
      limit,
      current,
      plan,
    );
  }
}