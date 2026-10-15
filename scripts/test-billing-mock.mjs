// End-to-end test for the billing mock-checkout fallback.
//
// This is the user-reported scenario. The dev environment has
// `.env` left at the Stripe placeholders (`sk_test_REPLACE_ME`,
// `price_REPLACE_ME`), so the real Stripe Checkout flow throws
// "Invalid API Key provided" before it can create a session.
// The mock fallback should kick in instead:
//
//   1. /api/stripe/checkout returns 200 with { url, mock: true }
//      and the URL points at /dashboard/billing/success.
//   2. The DB subscription row gets plan=premium, status=active,
//      a 30-day currentBillingPeriod, and stripeSubscriptionId
//      starting with "sub_mock".
//   3. /dashboard/billing renders the upgraded Premium state —
//      "Current plan: Premium", larger maxSpaces (25) and
//      maxTestimonialsPerSpace (1000) — once the page is fetched
//      with the user's session cookie.
//   4. /dashboard/billing/success renders the celebration card
//      and, when ?payment=mock, the "Mock checkout complete"
//      copy.
//
// Cleans up by deleting the test user at the end so the script
// is idempotent.

import { PrismaClient } from "@prisma/client";

const BASE = process.env.E2E_BASE || "http://localhost:3009";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`ok  : ${msg}`);
  }
}

let cookie = "";

async function req(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set("Cookie", cookie);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const first = sc.split(";")[0];
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (!name) continue;
    const parts = cookie ? cookie.split("; ") : [];
    const filtered = parts.filter((c) => c && !c.startsWith(name + "="));
    filtered.push(`${name}=${value}`);
    cookie = filtered.join("; ");
  }
  return res;
}

// -----------------------------------------------------------------
// 1) Register a fresh user.
// -----------------------------------------------------------------
const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `billing-mock-${unique}@example.com`;
const name = "Billing Mock";
const password = "hunter22hunter22";

{
  cookie = "";
  const reg = await req("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  const regBody = await reg.json().catch(() => ({}));
  assert(reg.status === 201, `Register returns 201 (got ${reg.status})`);
  assert(typeof regBody.id === "string", "Register returns a user id");
}

// -----------------------------------------------------------------
// 2) Sign in to get a session cookie (same as the BillingClient
//    uses to identify the user).
// -----------------------------------------------------------------
{
  const csrfRes = await req("/api/auth/csrf");
  const csrfBody = await csrfRes.json().catch(() => ({}));
  const csrfToken = csrfBody.csrfToken;
  assert(typeof csrfToken === "string", "Got CSRF token");

  const signinRes = await req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email,
      password,
      csrfToken,
      callbackUrl: BASE + "/dashboard/billing",
      redirect: "false",
      json: "true",
    }).toString(),
  });
  assert(
    signinRes.status === 200 || signinRes.status === 302,
    `Sign-in returns 200/302 (got ${signinRes.status})`,
  );
}

// -----------------------------------------------------------------
// 3) Pre-check: subscription is free (or absent) before POST.
// -----------------------------------------------------------------
const prisma = new PrismaClient();
const userIdLookup = await prisma.user.findUnique({
  where: { email },
  select: { id: true },
});
assert(typeof userIdLookup?.id === "string", "Test user exists in DB");
const userId = userIdLookup.id;

{
  const before = await prisma.subscription.findFirst({
    where: { userId },
    select: { plan: true, status: true },
  });
  assert(
    before === null || before.plan !== "premium",
    "Subscription is not premium before checkout",
  );
}

// -----------------------------------------------------------------
// 4) POST /api/stripe/checkout — should hit the mock fallback
//    because Stripe credentials are still placeholders.
// -----------------------------------------------------------------
let mockUrl = "";
{
  const res = await req("/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200) {
    console.error("Checkout response body:", body);
  }
  assert(res.status === 200, `Checkout returns 200 (got ${res.status})`);
  assert(typeof body.url === "string", "Checkout returns a url");
  assert(body.mock === true, "Checkout flags mock mode");
  assert(
    body.url.includes("/dashboard/billing/success"),
    "Mock URL points at /dashboard/billing/success",
  );
  assert(
    body.url.includes("payment=mock"),
    "Mock URL includes ?payment=mock",
  );
  // Capture for diagnostics if a later assertion fails.
  mockUrl = body.url;
}

// -----------------------------------------------------------------
// 5) Subscription row was upgraded.
// -----------------------------------------------------------------
{
  // The mock URL is just a value the test captured earlier; we
  // assert on the DB-side effects of the upgrade here.
  void mockUrl;
  const after = await prisma.subscription.findFirst({
    where: { userId },
    select: {
      plan: true,
      status: true,
      currentBillingPeriod: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
    },
  });
  assert(after !== null, "Subscription row exists after mock checkout");
  assert(after.plan === "premium", "Subscription plan is 'premium'");
  assert(after.status === "active", "Subscription status is 'active'");
  assert(
    after.stripeSubscriptionId === "sub_mock",
    "stripeSubscriptionId is 'sub_mock'",
  );
  assert(
    typeof after.currentBillingPeriod === "object" &&
      after.currentBillingPeriod instanceof Date,
    "currentBillingPeriod is a Date",
  );
  const now = Date.now();
  const periodMs = after.currentBillingPeriod.getTime() - now;
  const day = 24 * 60 * 60 * 1000;
  assert(
    periodMs > 25 * day && periodMs < 35 * day,
    "currentBillingPeriod is roughly 30 days out",
  );
}

// -----------------------------------------------------------------
// 6) /dashboard/billing reflects the upgrade.
// -----------------------------------------------------------------
{
  const res = await req("/dashboard/billing");
  const body = await res.text();
  assert(res.status === 200, `/dashboard/billing returns 200 (got ${res.status})`);
  assert(body.includes("Premium"), "Billing page renders 'Premium'");
  assert(body.includes(">25<"), "Billing page shows maxSpaces=25");
  assert(
    body.includes(">1000<"),
    "Billing page shows maxTestimonialsPerSpace=1000",
  );
  assert(
    !body.includes("Upgrade to Premium"),
    "Billing page no longer shows the Upgrade to Premium headline",
  );
}

// -----------------------------------------------------------------
// 7) /dashboard/billing/success?payment=mock renders the celebration.
// -----------------------------------------------------------------
{
  const res = await req("/dashboard/billing/success?payment=mock");
  const body = await res.text();
  assert(
    res.status === 200,
    `/dashboard/billing/success returns 200 (got ${res.status})`,
  );
  assert(body.includes("Mock checkout complete"), "Success page shows mock headline");
  assert(body.includes("Back to Billing"), "Success page shows 'Back to Billing' button");
  assert(body.includes("Go to Dashboard"), "Success page shows 'Go to Dashboard' button");
}

// -----------------------------------------------------------------
// 8) Idempotency: a second mock checkout keeps the same row in
//    the same state.
// -----------------------------------------------------------------
{
  await req("/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const after = await prisma.subscription.findFirst({
    where: { userId },
    select: { plan: true, status: true, stripeSubscriptionId: true },
  });
  assert(after.plan === "premium", "Second mock checkout: plan still premium");
  assert(after.status === "active", "Second mock checkout: status still active");
  assert(
    after.stripeSubscriptionId === "sub_mock",
    "Second mock checkout: stripeSubscriptionId still sub_mock",
  );
}

// Clean up
try {
  await prisma.user.deleteMany({ where: { email } });
  console.log("ok  : cleaned up test user");
} finally {
  await prisma.$disconnect();
}

console.log("\nBilling mock flow: all assertions passed.");
