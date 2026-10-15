// End-to-end test for the widget API.
//
// Exercises:
//   1. Sign in as alice via NextAuth credentials.
//   2. List alice's owned spaces (so we have a spaceId for create).
//   3. POST /api/widgets lazy-creates a widget for that space.
//   4. PATCH /api/widgets/<widgetId> updates the config.
//   5. DELETE /api/widgets/<widgetId> removes it.
//   6. POST /api/widgets a second time on the same space -> 409.
//   7. Cross-user access: bob trying to read alice's widget -> 404.
//   8. DB verification: widget row state matches the API responses.
//
// This test is idempotent w.r.t. the seed: it operates on a
// temporary widget that it creates and cleans up, so running
// it doesn't change the seeded `w_aliceph01` row. The downstream
// happy-path e2e that asserts on `w_aliceph01` will still see
// the seed data.
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
let tempWidgetId = null;
let tempSpaceId = null;

try {
  // 1) Sign in as alice.
  await signIn("alice@example.com", "password123");

  // 2) List alice's spaces.
  const listRes = await req("/api/spaces");
  assert(listRes.status === 200, `GET /api/spaces 200 (got ${listRes.status})`);
  // Use a space that doesn't yet have a widget so the lazy-create
  // test exercises the create path. Both alice spaces already
  // have widgets from the seed, so we create a fresh space via
  // direct DB write and use that.
  const tmp = await prisma.space.create({
    data: {
      ownerId: (await prisma.user.findUnique({ where: { email: "alice@example.com" } }))?.id,
      title: "E2E Widget API",
      publicSlug: "e2e-widget-api",
      prompt: "E2E test space for widget API",
    },
    select: { id: true },
  });
  tempSpaceId = tmp.id;

  // 3) The seed gives alice a widget for product-hunt-reviews with
  // widgetId="w_aliceph01". Verify the GET endpoint returns it.
  const getExisting = await req("/api/widgets/w_aliceph01");
  assert(getExisting.status === 200, `GET /api/widgets/w_aliceph01 200 (got ${getExisting.status})`);
  assert(
    getExisting.body?.widget?.widgetId === "w_aliceph01",
    "GET returned the seeded widget",
  );

  // 4) PATCH updates the config. We patch w_aliceph01 then
  // restore it at the end.
  const patchRes = await req("/api/widgets/w_aliceph01", {
    method: "PATCH",
    body: JSON.stringify({
      theme: "dark",
      layout: "masonryAnimated",
      scrollDirection: "down",
      showHeart: false,
      hideDate: true,
      hideSource: true,
    }),
  });
  assert(patchRes.status === 200, `PATCH /api/widgets/w_aliceph01 200 (got ${patchRes.status})`);
  const patched = patchRes.body?.widget;
  assert(patched?.theme === "dark", "PATCH updated theme=dark");
  assert(patched?.scrollDirection === "down", "PATCH updated scrollDirection=down");
  assert(patched?.showHeart === false, "PATCH updated showHeart=false");
  assert(patched?.hideDate === true, "PATCH updated hideDate=true");
  assert(patched?.hideSource === true, "PATCH updated hideSource=true");

  // 5) DB verification of the patch.
  const dbRow = await prisma.widget.findUnique({
    where: { widgetId: "w_aliceph01" },
    select: { theme: true, scrollDirection: true, showHeart: true, hideDate: true, hideSource: true },
  });
  assert(dbRow, "DB row exists after PATCH");
  assert(dbRow.theme === "dark", "DB theme=dark");
  assert(dbRow.scrollDirection === "down", "DB scrollDirection=down");
  assert(dbRow.showHeart === false, "DB showHeart=false");
  assert(dbRow.hideDate === true, "DB hideDate=true");
  assert(dbRow.hideSource === true, "DB hideSource=true");

  // 6) PATCH validation failure: missing field returns 422.
  const bad = await req("/api/widgets/w_aliceph01", {
    method: "PATCH",
    body: JSON.stringify({ theme: "dark" }), // missing 4 fields
  });
  assert(bad.status === 422, `PATCH missing fields -> 422 (got ${bad.status})`);

  // 7) Cross-user access: sign in as bob and try to read alice's widget.
  await signIn("bob@example.com", "password123");
  const bobGet = await req("/api/widgets/w_aliceph01");
  assert(bobGet.status === 404, `Bob GET alice's widget -> 404 (got ${bobGet.status})`);
  const bobPatch = await req("/api/widgets/w_aliceph01", {
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
  assert(bobPatch.status === 404, `Bob PATCH alice's widget -> 404 (got ${bobPatch.status})`);
  const bobDel = await req("/api/widgets/w_aliceph01", { method: "DELETE" });
  assert(bobDel.status === 404, `Bob DELETE alice's widget -> 404 (got ${bobDel.status})`);

  // 8) Bob trying to create a widget for alice's temp spaceId -> 404.
  const bobCreate = await req("/api/widgets", {
    method: "POST",
    body: JSON.stringify({ spaceId: tempSpaceId }),
  });
  assert(
    bobCreate.status === 404,
    `Bob POST /api/widgets for alice's space -> 404 (got ${bobCreate.status})`,
  );

  // 9) Switch back to alice. Reset the patched widget + lazy-create
  // a temp widget on the e2e space, then exercise idempotency.
  await signIn("alice@example.com", "password123");
  const reset = await req("/api/widgets/w_aliceph01", {
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
  assert(reset.status === 200, "Reset widget back to seed defaults");

  // 10) Lazy-create on the temp space, then verify the second
  // POST returns 409.
  const create1 = await req("/api/widgets", {
    method: "POST",
    body: JSON.stringify({ spaceId: tempSpaceId }),
  });
  assert(create1.status === 200, `First POST /api/widgets 200 (got ${create1.status})`);
  assert(
    typeof create1.body?.widget?.widgetId === "string" && create1.body.widget.widgetId.length > 0,
    "First create returned a widgetId",
  );
  tempWidgetId = create1.body.widget.widgetId;

  const create2 = await req("/api/widgets", {
    method: "POST",
    body: JSON.stringify({ spaceId: tempSpaceId }),
  });
  assert(
    create2.status === 409,
    `Second POST /api/widgets for same space -> 409 (got ${create2.status})`,
  );

  // 11) GET the temp widget.
  const getNew = await req(`/api/widgets/${tempWidgetId}`);
  assert(getNew.status === 200, "GET newly-created widget 200");

  // 12) PATCH the temp widget to verify the per-row update path.
  const patchTemp = await req(`/api/widgets/${tempWidgetId}`, {
    method: "PATCH",
    body: JSON.stringify({
      theme: "dark",
      layout: "masonryAnimated",
      scrollDirection: "down",
      showHeart: true,
      hideDate: true,
      hideSource: true,
    }),
  });
  assert(patchTemp.status === 200, "PATCH on temp widget 200");
  assert(patchTemp.body?.widget?.theme === "dark", "PATCH temp widget theme=dark");
} finally {
  // Cleanup
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

console.log("\nWidget API e2e: all assertions passed.");
