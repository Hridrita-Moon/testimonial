// Reproduce the exact form-body shape the browser sends.
// The browser uses fetch with JSON.stringify(parsed.data).
// parsed.data is the Zod-parsed object. Test that exact body.
const BASE = process.env.E2E_BASE || "http://localhost:3003";
const slug = "product-hunt-reviews";

// This is what the form would build from a fully filled-out state:
// contributorName="Jane", contributorEmail="jane@acme.com",
// testimonialText="Loved it!", rating=5, socialConsent=true,
// additionalValues={ companyName: "ACME" }
const body = {
  contributorName: "Jane",
  contributorEmail: "jane@acme.com",
  testimonialText: "Loved it!",
  rating: 5,
  socialConsent: true,
  additionalValues: { companyName: "ACME" },
};
const res = await fetch(BASE + `/api/spaces/${slug}/testimonials`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log("status:", res.status);
console.log("body:", await res.text());
