import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getPremiumPriceId, getAppUrl, stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";


/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the Premium plan and returns
 * its URL. The client should `window.location` to that URL.
 *
 * Request body:
 *   { userId: string, priceId?: string }
 *
 * `userId` is also stored in `session.metadata.userId` so the webhook
 * handler can identify which user to upgrade without trusting any
 * client-supplied data on the success page.
 */
export async function POST(request: NextRequest) {
  let body: { userId?: string; priceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { userId } = body;
  const priceId = body.priceId ?? process.env.STRIPE_PREMIUM_PRICE_ID;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid `userId`" },
      { status: 400 },
    );
  }

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

  // Confirm the user exists before creating a session. We never trust
  // the client to tell us about other users; a missing user is a 404.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const appUrl = getAppUrl();

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: resolvedPriceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard?payment=cancelled`,
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

  // Re-use an existing Stripe customer if we already have one so the
  // customer can see the charge in their existing Stripe billing
  // history; otherwise let Stripe create a new one.
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
    const session = await stripe.checkout.sessions.create(sessionParams);
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create checkout session: ${message}` },
      { status: 500 },
    );
  }
}
