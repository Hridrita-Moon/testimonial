/**
 * Plan limits and pricing.
 *
 * Per PRD section 3.8 these values must be configurable, not
 * hardcoded throughout the app. The environment variable is the
 * single source of truth for the price, and the limits object is
 * imported wherever the app needs to gate usage.
 */

export const PLAN_LIMITS = {
  free: {
    maxSpaces: 3,
    maxTestimonialsPerSpace: 100,
    label: "Free",
  },
  premium: {
    maxSpaces: 25,
    maxTestimonialsPerSpace: 1000,
    label: "Premium",
  },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;
export type PlanLimits = (typeof PLAN_LIMITS)[PlanKey];

/** True when the plan string stored on a Subscription row should be
 *  treated as premium. We keep the storage value free-form so future
 *  plans (e.g. team) can be added without a migration. */
export function isPremium(plan: string | null | undefined): boolean {
  return plan === "premium";
}

export function getLimitsForPlan(plan: string | null | undefined): PlanLimits {
  return isPremium(plan) ? PLAN_LIMITS.premium : PLAN_LIMITS.free;
}

/** Monthly price for the Premium plan. Reads from env so marketing can
 *  change the displayed price without a code change. */
export function getPremiumPriceDisplay(): string {
  const amount = process.env.NEXT_PUBLIC_PREMIUM_PRICE_DISPLAY ?? "$99";
  return `${amount}/month`;
}
