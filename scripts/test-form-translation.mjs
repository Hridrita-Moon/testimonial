// Test the form's key-translation logic directly, plus the full
// form-body → server round trip that a browser would make.
//
// The first half calls `translateToSchemaBody` and asserts the
// output matches the schema-side keys. The second half POSTs the
// translated body to the live server and asserts 201 + DB row.
//
// Run:  E2E_BASE=http://localhost:3007 node scripts/test-form-translation.mjs

import { PrismaClient } from "@prisma/client";
import { translateToSchemaBody, inputKeyFor } from "../lib/form-keys.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`ok  : ${msg}`);
  }
}

// --- Unit tests on the translation function ---

// 1) The exact form body from the user's screenshot
const formBody = {
  name: "Hridrita Saha Moon",
  email: "moonsaha721@gmail.com",
  testimonialText: "goooodddddd",
  rating: 2,
  socialConsent: true,
};
const translated = translateToSchemaBody(formBody);
assert(
  translated.contributorName === "Hridrita Saha Moon",
  "name → contributorName",
);
assert(
  translated.contributorEmail === "moonsaha721@gmail.com",
  "email → contributorEmail",
);
assert(
  translated.testimonialText === "goooodddddd",
  "testimonialText passes through",
);
assert(translated.rating === 2, "rating passes through");
assert(translated.socialConsent === true, "socialConsent passes through");
assert(translated.name === undefined, "form-shape `name` is gone");
assert(translated.email === undefined, "form-shape `email` is gone");

// 2) The inverse function maps server-side field errors back to the
//    right input key.
assert(inputKeyFor("contributorName") === "name", "contributorName → name");
assert(inputKeyFor("contributorEmail") === "email", "contributorEmail → email");
assert(
  inputKeyFor("testimonialText") === "testimonialText",
  "testimonialText identity",
);
assert(
  inputKeyFor("unknown-field") === "unknown-field",
  "unknown field passes through unchanged",
);

// 3) additionalValues (the optional three) passes through unchanged.
const withOpts = translateToSchemaBody({
  testimonialText: "x",
  additionalValues: { companyName: "ACME", socialLinks: "@x" },
});
assert(
  withOpts.additionalValues &&
    withOpts.additionalValues.companyName === "ACME",
  "additionalValues preserved verbatim",
);

// --- End-to-end: send the translated body to the live server ---

const BASE = process.env.E2E_BASE || "http://localhost:3007";

// Use the seeded alice space (always present) as the target.
// The previous version of this test relied on a hardcoded slug
// that was tied to a one-off user session; that space no longer
// exists. The seed gives us `product-hunt-reviews` reliably.
const slug = "product-hunt-reviews";

const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const browserBody = {
  name: `E2E Form Test ${unique}`,
  email: `e2e-form-${unique}@example.com`,
  testimonialText: "Submitted via the form's translation layer.",
  rating: 4,
  socialConsent: true,
};
const schemaBody = translateToSchemaBody(browserBody);

const res = await fetch(BASE + `/api/spaces/${slug}/testimonials`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(schemaBody),
});
const payload = await res.json().catch(() => ({}));
assert(res.status === 201, `Form-translated body returns 201 (got ${res.status})`);
assert(typeof payload.id === "string", "Server returns an id");

// Confirm the DB row was actually persisted
const prisma = new PrismaClient();
try {
  const row = await prisma.testimonial.findUnique({
    where: { id: payload.id },
    select: { contributorName: true, contributorEmail: true, rating: true },
  });
  assert(row, "DB row exists");
  assert(
    row.contributorName === browserBody.name,
    "DB contributorName matches form `name`",
  );
  assert(
    row.contributorEmail === browserBody.email,
    "DB contributorEmail matches form `email`",
  );
  assert(row.rating === 4, "DB rating is 4");
} finally {
  await prisma.$disconnect();
}

console.log("\nForm translation: all assertions passed.");
