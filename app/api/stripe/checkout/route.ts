/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the Premium plan and returns
 * its URL. The client should `window.location` to that URL.
 *
 * Auth: the user id is read from the session cookie via
 * `await auth()`. The body's `userId` (if present) is ignored — the
 * server never trusts the client to identify the user. The body
 * still accepts a `userId` for forward-compat with prefilled success
 * URLs, but the server derives the actual user from the session.
 *
 * `userId` is also stored in `session.metadata.userId` so the
 * webhook handler can identify which user to upgrade without
 * trusting any client-supplied data on the success page.
 *
 * Mock fallback: when Stripe is not configured (env placeholders
 * still in `.env`), this route immediately upgrades the user's
 * local subscription row to `plan=premium`/`status=active` and
 * returns a response with `mock: true` and a URL pointing at
 * `/dashboard/billing/success?payment=mock`. This keeps the demo
 * flow working end-to-end without a real Stripe account.
 *
 * `userId` is also stored in `session.metadata.userId` so the
 * webhook handler can identify which user to upgrade without
 * trusting any client-supplied data on the success page.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getPremiumPriceId,
  getAppUrl,
  isStripeConfigured,
  stripe,
} from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // Body is parsed only for forward-compat (e.g. a price override);
  // we never read `userId` from it.
  let body: { priceId?: string } = {};
  try {
    body = (await request.json()) as { priceId?: string };
  } catch {
    /* empty body is fine */
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Confirm the user exists before doing anything. We never trust
  // the client to tell us about other users; a missing user (e.g.
  // an account deleted between sign-in and checkout) is a 404.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Mock fallback: when Stripe isn't configured (env placeholders),
  // perform the upgrade locally and return a URL to the success
  // page. This keeps the demo flow working end-to-end while we
  // wait on real credentials.
  if (!isStripeConfigured()) {
    await upgradeToPremiumMock(user.id);
    const url = `${getAppUrl()}/dashboard/billing/success?payment=mock`;
    return NextResponse.json({ url, mock: true });
  }

  const priceId = body.priceId ?? process.env.STRIPE_PREMIUM_PRICE_ID;

  // Resolve the actual price id (validates env is configured).
  let resolvedPriceId: string;
  try {
    resolvedPriceId = priceId ?? getPremiumPriceId();
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }

  const appUrl = getAppUrl();

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: resolvedPriceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing/success?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard/billing/success?payment=cancelled`,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
      },
    },
  };

  // Re-use an existing Stripe customer if we already have one so
  // the customer can see the charge in their existing Stripe
  // billing history; otherwise let Stripe create a new one.
  const existingSubscription = await prisma.subscription.findFirst({
    where: { userId: user.id, stripeCustomerId: { not: null } },
    select: { stripeCustomerId: true },
  });

  if (existingSubscription?.stripeCustomerId) {
    sessionParams.customer = existingSubscription.stripeCustomerId;
  } else {
    sessionParams.customer_email = user.email;
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);
    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create checkout session: ${message}` },
      { status: 500 },
    );
  }
}

/**
 * Mock-checkout upgrade path. Upserts a `Subscription` row for
 * `userId` with `plan=premium`, `status=active`, and a 30-day
 * `currentBillingPeriod`. Mirrors what the Stripe webhook would
 * persist on `checkout.session.completed` so the rest of the app
 * (Billing UI, plan-limit gates) sees a consistent state.
 *
 * Designed to be safe to call repeatedly: the upsert converges
 * to the same row, so a duplicate mock POST is idempotent.
 */
export async function upgradeToPremiumMock(userId: string): Promise<void> {
  const currentBillingPeriod = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  );
  await prisma.$transaction(async (tx) => {
    const existing = await tx.subscription.findFirst({
      where: { userId },
      select: { id: true, stripeCustomerId: true },
    });
    const data = {
      plan: "premium",
      status: "active",
      // Mark mock subscriptions so the UI/billing portal can tell
      // them apart from real Stripe subscriptions.
      stripeCustomerId: existing?.stripeCustomerId ?? "cus_mock",
      stripeSubscriptionId: "sub_mock",
      currentBillingPeriod,
    };
    if (existing) {
      await tx.subscription.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await tx.subscription.create({
        data: { userId, ...data },
      });
    }
  });
}
