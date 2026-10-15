// This script sends the EXACT body that the form would build:
// values from the inputs use fieldType as the key (name, email, testimonialText),
// NOT the schema-shaped keys (contributorName, contributorEmail).
// This is what the browser is actually POSTing.
const BASE = process.env.E2E_BASE || "http://localhost:3006";
const slug = "agentic-engineering";

const body = {
  name: "Hridrita Saha Moon",
  email: "moonsaha721@gmail.com",
  testimonialText: "goooodddddd",
  rating: 2,
  socialConsent: true,
};
console.log("→ POST", BASE + `/api/spaces/${slug}/testimonials`);
console.log("→ body", body);
const res = await fetch(BASE + `/api/spaces/${slug}/testimonials`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log("← status", res.status);
console.log("← body  ", await res.text());
