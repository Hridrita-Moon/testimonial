// Simulate exactly what the browser does when the form is submitted:
// - Same User-Agent, Origin, Referer headers
// - Same body shape (the parsed.data from client-side Zod)
// - Same fetch options
// We do not include the JS preflight, because the server re-validates
// anyway — this test exercises the network path that runs after the
// preflight passes.
const BASE = process.env.E2E_BASE || "http://localhost:3005";
const slug = "product-hunt-reviews";

const body = {
  contributorName: "Browser Repro",
  contributorEmail: `browser-repro-${Date.now()}@example.com`,
  testimonialText: "Submitted from a browser-shaped request.",
  rating: 5,
  socialConsent: true,
  additionalValues: { companyName: "ACME" },
};

console.log("→ POST", BASE + `/api/spaces/${slug}/testimonials`);
const res = await fetch(BASE + `/api/spaces/${slug}/testimonials`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Origin: BASE,
    Referer: BASE + `/p/${slug}`,
  },
  body: JSON.stringify(body),
});
console.log("← status", res.status);
console.log("← body  ", await res.text());
