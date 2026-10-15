// Updated: don't redirect, capture all set-cookies, and follow the
// auth callback response status. The credentials authorize in v5
// usually returns 302 to a callbackUrl.
const BASE = process.env.E2E_BASE || "http://localhost:3009";
let cookie = "";
async function req(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set("Cookie", cookie);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const first = sc.split(";")[0];
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    const parts = cookie ? cookie.split("; ") : [];
    const filtered = parts.filter((c) => c && !c.startsWith(name + "="));
    filtered.push(`${name}=${value}`);
    cookie = filtered.join("; ");
  }
  return { status: res.status, body: await res.text(), setCookies };
}
const csrf = await req("/api/auth/csrf");
console.log("csrf cookies:", cookie);
const form = new URLSearchParams({
  csrfToken: csrf.body.csrfToken,
  email: "alice@example.com",
  password: "password123",
  callbackUrl: BASE + "/dashboard",
  json: "true",
});
const signin = await req("/api/auth/callback/credentials", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: form.toString(),
});
console.log("signin status:", signin.status);
console.log("cookies after signin:", cookie);
const sess = await req("/api/auth/session");
console.log("session:", sess.body);
const r = await req("/dashboard/wall");
console.log("dashboard wall status:", r.status);
if (r.status === 200) {
  const matches = r.body.match(/href="\/p\/[^"]+"/g);
  console.log("/p/ hrefs:", matches);
  const idx = r.body.indexOf("View public URL");
  console.log("has 'View public URL':", idx >= 0);
}