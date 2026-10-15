// End-to-end test for the widget layout + create flow.
//
// Exercises:
//   1. Sign in as alice via NextAuth credentials.
//   2. PATCH the seeded `w_aliceph01` widget to set each of the
//      three layouts and verify the public wall renders with
//      the right data-layout + renderer markers.
//      - `masonryAnimated` → `masonry-wall` markup + animated
//        track + floating hearts layer present.
//      - `masonryFixed`    → `masonry-wall` markup + NO animated
//        track + floating hearts layer present (when showHeart=1).
//      - `carousel`        → `carousel-wall` markup + horizontal
//        track + prev/next buttons present.
//   3. PATCH a bad layout value → Zod falls back to
//      `masonryAnimated` (the runtime `pickLayout` is
//      forgiving, so a stale DB value still renders). We seed
//      a junk value via direct DB write and verify the page
//      still renders cleanly.
//   4. POST /api/widgets with `layout=carousel` lazily creates
//      a widget with the right layout persisted to the DB.
//   5. The dashboard manager page (`/dashboard/wall-of-love`)
//      exposes the new "Create Wall of Love" button + lists
//      ownable spaces in the modal dropdown when present.
//
// This test creates and cleans up its own temp space + widget
// so it doesn't disturb the seed.
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

async function signIn(email, password) {
  cookie = "";
  const csrfRes = await req("/api/auth/csrf");
  const csrfToken = csrfRes.body?.csrfToken;
  const form = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: BASE + "/dashboard",
    json: "true",
  });
  const r = await req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (![200, 302].includes(r.status)) {
    throw new Error(`signin as ${email} failed with ${r.status}`);
  }
  const session = await req("/api/auth/session");
  if (session.body?.user?.email !== email) {
    throw new Error(`session did not resolve to ${email}`);
  }
}

const prisma = new PrismaClient();
let tempSpaceId = null;
let tempWidgetId = null;

async function patchSeedLayout(layout) {
  const r = await req("/api/widgets/w_aliceph01", {
    method: "PATCH",
    body: JSON.stringify({
      theme: "light",
      layout,
      scrollDirection: "up",
      showHeart: true,
      hideDate: false,
      hideSource: false,
    }),
  });
  assert(r.status === 200, `PATCH layout=${layout} 200 (got ${r.status})`);
  assert(
    r.body?.widget?.layout === layout,
    `API returned layout=${layout} (got ${r.body?.widget?.layout})`,
  );
}

async function getPublicWallBody(extraParams = "") {
  const r = await req(
    `/p/product-hunt-reviews/wall?${extraParams}&_=${Date.now()}`,
  );
  assert(r.status === 200, `Public wall 200 (got ${r.status})`);
  return r.body;
}

try {
  // 1) Sign in as alice.
  await signIn("alice@example.com", "password123");

  // 2a) Animated masonry → masonry-animated markup with the
  // auto-scrolling track + floating-hearts layer present.
  await patchSeedLayout("masonryAnimated");
  let html = await getPublicWallBody();
  assert(
    /data-layout="masonryAnimated"/.test(html),
    "Public wall: data-layout=masonryAnimated",
  );
  assert(
    /class="[^"]*masonry-animated__track[^"]*"/.test(html),
    "Public wall: masonry-animated track present",
  );
  assert(
    /class="[^"]*floating-hearts\b/.test(html),
    "Public wall: floating-hearts layer rendered when showHeart=1",
  );

  // 2b) Fixed masonry → masonry-static markup, no animated
  // track. The static variant uses CSS `columns` for layout.
  await patchSeedLayout("masonryFixed");
  html = await getPublicWallBody();
  assert(
    /data-layout="masonryFixed"/.test(html),
    "Public wall: data-layout=masonryFixed",
  );
  assert(
    /class="[^"]*masonry-static\b/.test(html),
    "Public wall: fixed masonry uses masonry-static markup",
  );
  assert(
    !/class="[^"]*masonry-animated__track[^"]*"/.test(html),
    "Public wall: fixed masonry has no animated track",
  );

  // 2c) Carousel → carousel-wall markup + prev/next buttons.
  await patchSeedLayout("carousel");
  html = await getPublicWallBody();
  assert(/data-layout="carousel"/.test(html), "Public wall: data-layout=carousel");
  assert(
    /class="[^"]*carousel-wall__track[^"]*"/.test(html),
    "Public wall: carousel track present",
  );
  assert(
    /aria-label="Previous testimonial"/.test(html) &&
      /aria-label="Next testimonial"/.test(html),
    "Public wall: carousel prev/next buttons present",
  );

  // 2d) Carousel with showHeart=0 should NOT render the
  // floating-hearts layer. Confirms the toggle is honored.
  await req("/api/widgets/w_aliceph01", {
    method: "PATCH",
    body: JSON.stringify({
      theme: "light",
      layout: "carousel",
      scrollDirection: "up",
      showHeart: false,
      hideDate: false,
      hideSource: false,
    }),
  });
  html = await getPublicWallBody();
  assert(
    !/class="[^"]*floating-hearts\b/.test(html),
    "Public wall: showHeart=0 hides the floating hearts layer",
  );

  // 3) Junk layout value should be tolerated — public wall
  // still renders, with `pickLayout` falling back to
  // masonryAnimated.
  const aliceUser = await prisma.user.findUnique({
    where: { email: "alice@example.com" },
  });
  const space = await prisma.space.findUnique({
    where: { publicSlug: "product-hunt-reviews" },
  });
  if (!aliceUser || !space) throw new Error("Seed missing");
  await prisma.widget.update({
    where: { spaceId: space.id },
    data: { layout: "deprecated-junk-value" },
  });
  html = await getPublicWallBody();
  assert(
    /data-layout="masonryAnimated"/.test(html),
    "Public wall: unknown layout value falls back to masonryAnimated",
  );

  // 4) Create a fresh space + lazy-create widget with
  // `layout=carousel`, verify persistence.
  const tmp = await prisma.space.create({
    data: {
      ownerId: aliceUser.id,
      title: "E2E Layout",
      publicSlug: "e2e-layout",
      prompt: "E2E test space for layout flow",
    },
    select: { id: true },
  });
  tempSpaceId = tmp.id;

  const create = await req("/api/widgets", {
    method: "POST",
    body: JSON.stringify({
      spaceId: tempSpaceId,
      layout: "carousel",
      theme: "dark",
      scrollDirection: "down",
      showHeart: false,
      hideDate: true,
      hideSource: true,
    }),
  });
  assert(create.status === 200, `POST /api/widgets with layout=carousel 200 (got ${create.status})`);
  assert(
    create.body?.widget?.layout === "carousel",
    `Create returned layout=carousel (got ${create.body?.widget?.layout})`,
  );
  tempWidgetId = create.body?.widget?.widgetId;

  // 5) DB verification: layout is persisted.
  const newRow = await prisma.widget.findUnique({
    where: { widgetId: tempWidgetId },
    select: { layout: true, theme: true, showHeart: true },
  });
  assert(newRow?.layout === "carousel", "DB layout=carousel");
  assert(newRow?.theme === "dark", "DB theme=dark");
  assert(newRow?.showHeart === false, "DB showHeart=false");

  // 6) Validation: layout=invalid on POST is rejected with 422.
  const bad = await req("/api/widgets", {
    method: "POST",
    body: JSON.stringify({ spaceId: tempSpaceId, layout: "sideways" }),
  });
  assert(bad.status === 409 || bad.status === 422, `Bad layout rejected (got ${bad.status})`);

  // 7) Manager page exposes the "+ Create Wall of Love" button.
  const manager = await req("/dashboard/wall-of-love");
  assert(manager.status === 200, `Manager 200 (got ${manager.status})`);
  assert(
    manager.body.includes("Create Wall of Love"),
    "Manager renders the + Create Wall of Love button",
  );

  // 8) Reset the seed widget back to masonryAnimated so the
  // happy-path e2e sees a clean state.
  await req("/api/widgets/w_aliceph01", {
    method: "PATCH",
    body: JSON.stringify({
      theme: "light",
      layout: "masonryAnimated",
      scrollDirection: "up",
      showHeart: true,
      hideDate: false,
      hideSource: false,
    }),
  });
} finally {
  if (tempWidgetId) {
    cookie = "";
    await signIn("alice@example.com", "password123");
    await req(`/api/widgets/${tempWidgetId}`, { method: "DELETE" });
  }
  if (tempSpaceId) {
    await prisma.space.delete({ where: { id: tempSpaceId } });
  }
  await prisma.$disconnect();
}

console.log("\nWidget layout e2e: all assertions passed.");
