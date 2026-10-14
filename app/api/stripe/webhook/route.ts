import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook receiver. The PRD requires that the plan is only
 * ever upgraded via a verified Stripe event, NEVER from a success-
 * page redirect. So this is the single source of truth for plan
 * changes.
 *
 * Security:
 *  - We read the raw request body (no `request.json()`) because
 *    signature verification is byte-exact.
 *  - `stripe.webhooks.constructEvent` throws if the signature
 *    doesn't match. We return 400 in that case and never look at
 *    the event payload.
 *  - The handler is idempotent: Stripe retries failed webhooks, and
 *    we use `upsert` keyed on `stripeSubscriptionId` so duplicates
 *    converge to the same state.
 *
 * App Router note: Next.js will only let us read the raw body if we
 * opt out of the default body parser. We also have to return a
 * `Response` whose body is what Stripe expects (`{received: true}`)
 * and the right status code so it stops retrying on success.
 *
 * Note: the project's `next.config.ts` enables `cacheComponents`,
 * which is incompatible with `export const runtime` /
 * `export const dynamic` in route files, so we don't set them here.
 * POST routes are dynamic by default, and the default Node.js
 * runtime is what we want for raw-body access.
 */
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === "whsec_REPLACE_ME") {
    console.error(
      "STRIPE_WEBHOOK_SECRET is not configured; rejecting webhook.",
    );
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  // Read raw body bytes for signature verification.
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = (err as Error).message;
    console.warn(`Webhook signature verification failed: ${message}`);
    return NextResponse.json(
      { error: `Signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }
      default: {
        // Unhandled events should still return 200 so Stripe doesn't
        // retry them forever. We log so they're visible during dev.
        console.log(`Unhandled Stripe event type: ${event.type}`);
      }
    }
  } catch (err) {
    // Returning 500 tells Stripe to retry, which is what we want when
    // the failure is transient (e.g. DB blip).
    console.error(`Webhook handler error for ${event.type}:`, err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

/* ------------------------------------------------------------------ *
 * Handlers
 * ------------------------------------------------------------------ */

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  // We set both `client_reference_id` and `metadata.userId` when
  // creating the session. Prefer the explicit metadata.
  const userId =
    (session.metadata?.userId as string | undefined) ??
    (session.client_reference_id as string | undefined);

  if (!userId) {
    throw new Error(
      `checkout.session.completed ${session.id} missing userId in metadata`,
    );
  }

  // The subscription id is on the session once the subscription is
  // created. We can also pull the customer id here.
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : null;
  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  // Upsert keyed on userId: each user has at most one active
  // subscription row in our model. We use `update` when a row exists
  // and `create` when it doesn't. To keep this safe under retries we
  // `upsert` on a unique key — but our schema doesn't have a unique
  // on (userId, status='active'). Simpler: do a findFirst+conditional
  // write inside a transaction.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.subscription.findFirst({
      where: { userId },
    });

    const data = {
      plan: "premium",
      status: "active",
      stripeCustomerId: stripeCustomerId ?? existing?.stripeCustomerId ?? null,
      stripeSubscriptionId:
        stripeSubscriptionId ?? existing?.stripeSubscriptionId ?? null,
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

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  // Prefer metadata; fall back to looking up the customer in our DB.
  const userId =
    (subscription.metadata?.userId as string | undefined) ??
    (await findUserIdByCustomer(subscription.customer as string));

  if (!userId) {
    throw new Error(
      `subscription ${subscription.id} could not be linked to a user`,
    );
  }

  const plan = mapStripeStatusToPlan(subscription.status);
  const status = mapStripeStatusToLocalStatus(subscription.status);

  // `current_period_end` is on the subscription item in newer API
  // versions; we read it defensively.
  const currentBillingPeriod = readCurrentPeriodEnd(subscription);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.subscription.findFirst({ where: { userId } });
    const data = {
      plan,
      status,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      currentBillingPeriod,
    };

    if (existing) {
      await tx.subscription.update({ where: { id: existing.id }, data });
    } else {
      await tx.subscription.create({ data: { userId, ...data } });
    }
  });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId =
    (subscription.metadata?.userId as string | undefined) ??
    (await findUserIdByCustomer(subscription.customer as string));

  if (!userId) {
    // Already gone from our DB; nothing to do.
    return;
  }

  await prisma.subscription.updateMany({
    where: { userId, stripeSubscriptionId: subscription.id },
    data: { plan: "free", status: "cancelled" },
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId = invoice.customer as string | null;
  if (!customerId) return;

  const userId = await findUserIdByCustomer(customerId);
  if (!userId) return;

  // Mark the user's subscription as past-due so the UI can warn them,
  // but do NOT immediately downgrade to free — Stripe will retry and
  // eventually fire `customer.subscription.deleted` if all retries
  // fail.
  await prisma.subscription.updateMany({
    where: { userId, stripeCustomerId: customerId },
    data: { status: "past_due" },
  });
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

async function findUserIdByCustomer(
  customerId: string,
): Promise<string | null> {
  const sub = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });
  return sub?.userId ?? null;
}

function mapStripeStatusToPlan(status: Stripe.Subscription.Status): string {
  // Anything in a "paid" state is premium; otherwise the user is on
  // the free plan (we don't show a half-premium state).
  switch (status) {
    case "active":
    case "trialing":
      return "premium";
    default:
      return "free";
  }
}

function mapStripeStatusToLocalStatus(
  status: Stripe.Subscription.Status,
): string {
  // We use simple string statuses in the DB. The Prisma model doesn't
  // enforce an enum so this stays forward-compatible.
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    case "incomplete":
    case "paused":
      return status;
    default:
      return "active";
  }
}

function readCurrentPeriodEnd(
  subscription: Stripe.Subscription,
): Date | null {
  // The API version we pin stores this on subscription items. The
  // top-level `current_period_end` is deprecated in newer versions.
  const item = subscription.items?.data?.[0];
  // The Stripe TS types expose `current_period_end` on the item in
  // some API versions and on the subscription in others. Pull from
  // the most reliable place.
  const ts =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (subscription as unknown as { current_period_end?: number })
      .current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}
