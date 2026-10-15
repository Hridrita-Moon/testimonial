// End-to-end happy-path smoke against the production build.
// Exercises:
//   1. Sign in (NextAuth credentials provider) as alice
//   2. List owned spaces via /api/spaces
//   3. Read a single space via /api/spaces/<slug>
//   4. PATCH that space
//   5. Public submit a new testimonial via /api/spaces/<slug>/testimonials
//   6. List testimonials via /api/spaces/<slug>/testimonials (after listing endpoint exists)
//   7. Render the public submit page /p/<slug>
//   8. Render the public wall of love /p/<slug>/wall
//   9. Render the dashboard pages
//   9b. Render the Wall of Love manager (/dashboard/wall-of-love)
//       and verify its widget cards, action buttons, embed copy
//       surface, and sidebar links.
//  10. Sign out
import { PrismaClient } from "@prisma/client";

const BASE = process.env.E2E_BASE || "http://localhost:3002";

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
  // getSetCookie is the spec-compliant way to read multiple Set-Cookie
  // headers without parsing comma-separated strings (which can
  // contain commas inside Expires=...).
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
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, body, headers: res.headers };
}

// 1) Get CSRF token (NextAuth v5)
const csrfRes = await req("/api/auth/csrf");
assert(csrfRes.status === 200, `CSRF endpoint 200 (got ${csrfRes.status})`);
const csrfToken = csrfRes.body?.csrfToken;
assert(typeof csrfToken === "string" && csrfToken.length > 0, "CSRF token returned");

// 2) Sign in as alice via credentials callback
const signinForm = new URLSearchParams({
  csrfToken,
  email: "alice@example.com",
  password: "password123",
  callbackUrl: BASE + "/dashboard",
  json: "true",
});
const signinRes = await req("/api/auth/callback/credentials", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: signinForm.toString(),
});
// Auth.js v5 returns 200 with a JSON body, or 302 on success
assert(
  [200, 302].includes(signinRes.status),
  `Sign-in callback HTTP ${signinRes.status} (expected 200/302)`,
);

// 3) Verify session
const sessionRes = await req("/api/auth/session");
assert(sessionRes.status === 200, `Session endpoint 200 (got ${sessionRes.status})`);
assert(
  sessionRes.body?.user?.email === "alice@example.com",
  `Session email is alice (got ${sessionRes.body?.user?.email})`,
);

// 4) List spaces
const listRes = await req("/api/spaces");
assert(listRes.status === 200, `GET /api/spaces 200 (got ${listRes.status})`);
assert(Array.isArray(listRes.body?.spaces), "Spaces list is an array");
const target = listRes.body.spaces.find((s) => s.publicSlug === "product-hunt-reviews");
assert(target, "Found 'product-hunt-reviews' space in list");
const slug = target.publicSlug;
console.log(`     (target slug = ${slug}, id = ${target.id})`);

// 5) GET single space by slug
const oneRes = await req(`/api/spaces/${slug}`);
assert(oneRes.status === 200, `GET /api/spaces/${slug} 200 (got ${oneRes.status})`);
assert(
  oneRes.body?.space?.publicSlug === slug,
  `Single-space response has correct slug`,
);

// 6) PATCH that space (change prompt)
const newPrompt = `E2E test prompt ${Date.now()}`;
const patchRes = await req(`/api/spaces/${slug}`, {
  method: "PATCH",
  body: JSON.stringify({
    title: target.title,
    subtitle: target.subtitle ?? null,
    prompt: newPrompt,
    theme: "light",
    ratingEnabled: true,
    publicSlug: slug,
    enabledFields: {
      companyName: true,
      socialLinks: false,
      profilePhoto: false,
    },
  }),
});
assert(patchRes.status === 200, `PATCH /api/spaces/${slug} 200 (got ${patchRes.status})`);
assert(
  patchRes.body?.publicSlug === slug,
  "PATCH returned the slug",
);

// 7) Public submit a testimonial
const submitRes = await req(`/api/spaces/${slug}/testimonials`, {
  method: "POST",
  body: JSON.stringify({
    contributorName: "E2E Tester",
    contributorEmail: "e2e@test.com",
    testimonialText: "Smoke test from happy-path runner.",
    rating: 5,
    socialConsent: true,
    additionalValues: { companyName: "ACME" },
  }),
});
assert(submitRes.status === 201, `POST testimonial 201 (got ${submitRes.status})`);
assert(typeof submitRes.body?.id === "string", "Submission returned an id");
const newTestimonialId = submitRes.body.id;
console.log(`     (new testimonial id = ${newTestimonialId})`);

// 8) Verify the testimonial landed in the DB
const prisma = new PrismaClient();
try {
  const dbRow = await prisma.testimonial.findUnique({
    where: { id: newTestimonialId },
    select: { contributorName: true, rating: true, visibilityStatus: true },
  });
  assert(dbRow, "Testimonial row found in DB");
  assert(dbRow.contributorName === "E2E Tester", "Name persisted");
  assert(dbRow.rating === 5, "Rating persisted");
  assert(dbRow.visibilityStatus === "published", "Published by default");
} finally {
  await prisma.$disconnect();
}

// 9) Public submit page renders
const pubRes = await req(`/p/${slug}`);
assert(pubRes.status === 200, `GET /p/${slug} 200 (got ${pubRes.status})`);
assert(pubRes.body.includes("Tell us") || pubRes.body.length > 1000, "Submit page rendered");

// 10) Public wall of love page renders
const wallRes = await req(`/p/${slug}/wall`);
assert(wallRes.status === 200, `GET /p/${slug}/wall 200 (got ${wallRes.status})`);

// 11) Dashboard pages render
for (const path of ["/dashboard", "/dashboard/spaces", "/dashboard/inbox", "/dashboard/billing", "/dashboard/settings", "/dashboard/wall-of-love"]) {
  const r = await req(path);
  assert(r.status === 200, `GET ${path} 200 (got ${r.status})`);
}

// 11) The retired /dashboard/wall preview page should now 404.
// The manager at /dashboard/wall-of-love replaces it.
const retiredWallRes = await req("/dashboard/wall");
assert(
  [404, 307].includes(retiredWallRes.status),
  `Retired /dashboard/wall returns 404/307 (got ${retiredWallRes.status})`,
);

// 11b) Dashboard pages include the new sidebar nav. Each of the
// five nav labels should appear in the rendered HTML on every
// dashboard page.
const sidebarLabels = ["Overview", "Spaces", "Inbox", "Wall of Love", "Settings"];
for (const path of ["/dashboard", "/dashboard/spaces", "/dashboard/inbox", "/dashboard/billing", "/dashboard/settings", "/dashboard/wall-of-love"]) {
  const r = await req(path);
  for (const label of sidebarLabels) {
    assert(
      r.body.includes(label),
      `${path} contains sidebar label "${label}"`,
    );
  }
}

// 11b2) The sidebar's "Wall of Love" link is /dashboard/wall-of-love
// (the manager), not the public /p/<slug>/wall route. This guards
// the refactor — if someone reverts the shell's nav, the
// dashboard version of the link disappears and clicking the
// sidebar takes the user out of the shell.
const dashboardPaths = ["/dashboard", "/dashboard/spaces", "/dashboard/inbox", "/dashboard/billing", "/dashboard/settings", "/dashboard/wall-of-love"];
for (const path of dashboardPaths) {
  const r = await req(path);
  assert(
    r.body.includes('href="/dashboard/wall-of-love"'),
    `${path} sidebar contains a link to /dashboard/wall-of-love`,
  );
}

// The dashboard shell itself should never have a sidebar link that
// points at the public /p/<slug>/wall. The manager cards on
// /dashboard/wall-of-love ARE allowed to contain such links (the
// "View public URL" button); for that path we only check the
// sidebar link is also /dashboard/wall-of-love.
for (const path of dashboardPaths) {
  const r = await req(path);
  // Strip the manager cards' "View public URL" buttons if the
  // path is the manager itself (they're not in the sidebar).
  const asideMatch = r.body.match(/<aside[^>]*aria-label="Dashboard sidebar"[\s\S]*?<\/aside>/);
  const sidebar = asideMatch ? asideMatch[0] : "";
  assert(
    !sidebar.includes("href=\"/p/"),
    `${path} sidebar has no /p/ links`,
  );
}

// 11b3) The Wall of Love manager renders one card per owned space
// and the spec'd action buttons (Edit, Copy embed, Delete) when a
// widget exists. Alice's seeded "product-hunt-reviews" has a
// widget with widgetId="w_aliceph01" (set by prisma/seed.ts).
const dashWallRes = await req("/dashboard/wall-of-love");
assert(
  /<h1[^>]*>\s*Wall of Love\s*<\/h1>/i.test(dashWallRes.body),
  "/dashboard/wall-of-love has 'Wall of Love' as H1",
);
assert(
  dashWallRes.body.includes("Edit"),
  "/dashboard/wall-of-love has Edit buttons",
);
assert(
  dashWallRes.body.includes("Copy embed code"),
  "/dashboard/wall-of-love has Copy embed code buttons",
);
assert(
  dashWallRes.body.includes("View wall"),
  "/dashboard/wall-of-love has 'View wall' buttons",
);
assert(
  dashWallRes.body.includes("w_aliceph01"),
  "/dashboard/wall-of-love surfaces the seeded widgetId for product-hunt-reviews",
);
const publicWallHrefs = dashWallRes.body.match(/href="\/p\/[^"\/]+\/wall"/g) ?? [];
assert(
  publicWallHrefs.length > 0,
  "/dashboard/wall-of-love has at least one /p/<slug>/wall link",
);

// 11c) Settings page shows the account email we signed in with.
const settingsRes = await req("/dashboard/settings");
assert(
  settingsRes.body.includes("alice@example.com"),
  "Settings page shows the signed-in user's email",
);
assert(
  settingsRes.body.includes("Manage billing"),
  "Settings page has a 'Manage billing' link",
);

// 12) Cross-user access: switch to bob and try alice's slug
const csrfRes2 = await req("/api/auth/csrf");
const csrfToken2 = csrfRes2.body.csrfToken;
const signinForm2 = new URLSearchParams({
  csrfToken: csrfToken2,
  email: "bob@example.com",
  password: "password123",
  callbackUrl: BASE + "/dashboard",
  json: "true",
});
const signinRes2 = await req("/api/auth/callback/credentials", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: signinForm2.toString(),
});
assert([200, 302].includes(signinRes2.status), "Sign-in as bob succeeded");
const bobOneRes = await req(`/api/spaces/${slug}`);
assert(
  bobOneRes.status === 404,
  `Bob GET alice's space -> 404 (got ${bobOneRes.status})`,
);

// 13) Sign out
const csrfRes3 = await req("/api/auth/csrf");
const signoutForm = new URLSearchParams({
  csrfToken: csrfRes3.body.csrfToken,
  callbackUrl: BASE + "/",
  json: "true",
});
const signoutRes = await req("/api/auth/signout", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: signoutForm.toString(),
});
assert([200, 302].includes(signoutRes.status), "Sign-out returned 200/302");

console.log("\nAll happy-path checks passed.");
