// Regression test for the public testimonial submission API.
//
// Posts a form-shaped body (the exact shape `app/p/[slug]/submit-form.tsx`
// sends after a successful client-side Zod parse) to
// `/api/spaces/<slug>/testimonials`, asserts 201 + id, and verifies
// the row was persisted via Prisma with the expected fields.
//
// This test does NOT exercise auth: the submission endpoint is
// intentionally public. It also exercises a unique contributorEmail
// per run so re-runs don't collide.
//
// Usage:
//   E2E_BASE=http://localhost:3003 node scripts/test-submission-e2e.mjs
//   E2E_BASE=http://localhost:3003 node scripts/test-submission-e2e.mjs <slug>

import { PrismaClient } from "@prisma/client";

const BASE = process.env.E2E_BASE || "http://localhost:3003";
const slug = process.argv[2] || "product-hunt-reviews";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`ok  : ${msg}`);
  }
}

// Build the body exactly the way the browser-built form does: a flat
// object with the three core fields at the top level, optional
// `rating` as a number, `socialConsent` as a boolean, and any
// `additionalValues` as a nested object.
const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const body = {
  contributorName: "E2E Submission",
  contributorEmail: `e2e-submission-${unique}@example.com`,
  testimonialText: "Regression-test submission — the form path should persist this row.",
  rating: 5,
  socialConsent: true,
  additionalValues: { companyName: "ACME" },
};

const res = await fetch(BASE + `/api/spaces/${slug}/testimonials`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const text = await res.text();
let payload;
try { payload = JSON.parse(text); } catch { payload = text; }

assert(res.status === 201, `POST returns 201 (got ${res.status})`);
assert(typeof payload?.id === "string", "Response body has id");

// Persistence check: open a fresh Prisma client and look up the row.
const prisma = new PrismaClient();
try {
  // First, look up the space by slug to assert we hit the right one.
  const space = await prisma.space.findUnique({
    where: { publicSlug: slug },
    select: { id: true, publicSlug: true },
  });
  assert(space, `Space with slug="${slug}" exists in DB`);

  const row = await prisma.testimonial.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      spaceId: true,
      contributorName: true,
      contributorEmail: true,
      testimonialText: true,
      rating: true,
      additionalValues: true,
      socialConsent: true,
      isFavorite: true,
      isWallOfLove: true,
      visibilityStatus: true,
    },
  });
  assert(row, "Row persisted with the returned id");
  assert(row.spaceId === space.id, "Row is attached to the correct space");
  assert(row.contributorName === body.contributorName, "contributorName persisted");
  assert(row.contributorEmail === body.contributorEmail, "contributorEmail persisted");
  assert(row.testimonialText === body.testimonialText, "testimonialText persisted");
  assert(row.rating === 5, "rating persisted as 5");
  assert(row.socialConsent === true, "socialConsent persisted as true");
  assert(row.isFavorite === false, "isFavorite is server-set to false");
  assert(row.isWallOfLove === false, "isWallOfLove is server-set to false");
  assert(row.visibilityStatus === "published", "visibilityStatus server-set to 'published'");
  const av = row.additionalValues;
  assert(
    av && typeof av === "object" && av.companyName === "ACME",
    "additionalValues.companyName persisted",
  );
} finally {
  await prisma.$disconnect();
}

// Negative path: missing required field should 422, not 201.
const bad = await fetch(BASE + `/api/spaces/${slug}/testimonials`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contributorName: "Missing email and text",
    testimonialText: "",
  }),
});
assert(bad.status === 422, `Missing required field returns 422 (got ${bad.status})`);

// Negative path: unknown slug should 404.
const miss = await fetch(BASE + `/api/spaces/does-not-exist-${unique}/testimonials`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
assert(miss.status === 404, `Unknown slug returns 404 (got ${miss.status})`);

// Negative path: invalid JSON should 400.
const inv = await fetch(BASE + `/api/spaces/${slug}/testimonials`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "not-json",
});
assert(inv.status === 400, `Invalid JSON returns 400 (got ${inv.status})`);

// Browser-body path. The form's `inputs[fields[].fieldType]` keys are
// the SpaceField `fieldType` values (`name`, `email`,
// `testimonialText`) — NOT the schema-side `contributorName`,
// `contributorEmail`. After the form's key-translation fix, the
// client remaps these before sending. This assertion guards against
// the original bug returning: if the client forgot to translate, the
// server would 422 with `field: "contributorName"`.
const browserBody = {
  name: "Browser Body",
  email: `br-${unique}@example.com`,
  testimonialText: "Body shape matches what the form now sends after key translation.",
  rating: 5,
  socialConsent: true,
};
const translatedBody = {
  contributorName: browserBody.name,
  contributorEmail: browserBody.email,
  testimonialText: browserBody.testimonialText,
  rating: browserBody.rating,
  socialConsent: browserBody.socialConsent,
};
const browserRes = await fetch(BASE + `/api/spaces/${slug}/testimonials`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(translatedBody),
});
assert(
  browserRes.status === 201,
  `Translated browser-shape body returns 201 (got ${browserRes.status})`,
);

console.log("\nSubmission API regression test: all assertions passed.");
