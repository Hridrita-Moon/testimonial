/**
 * Auth.js v5 configuration.
 *
 * The credentials provider authenticates against the `User` table
 * directly: lookup by email, `bcrypt.compare` on `passwordHash`. The
 * JWT session strategy means no `Account` / `Session` /
 * `VerificationToken` tables are required, which keeps the schema
 * portable between SQLite (dev) and Postgres (prod).
 *
 * The JWT `userId` is set in `callbacks.jwt` on sign-in and re-exposed
 * as `session.user.id` in `callbacks.session` on every request. The
 * route handler at `app/api/auth/[...nextauth]/route.ts` re-exports
 * `handlers.GET` and `handlers.POST`; the middleware at `proxy.ts`
 * imports the same `auth` function and gates `/dashboard/*` via
 * `callbacks.authorized`.
 *
 * `AUTH_SECRET` is the JWT signing secret. Auth.js v5 also picks up
 * `AUTH_URL` as the public base URL (no `NEXTAUTH_URL` is needed).
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT only — no DB session table. Bounded lifetime is Auth.js's
  // default (sliding 30 days).
  session: { strategy: "jwt" },
  // We render our own pages; the built-in `/api/auth/signin` is left
  // as a fallback only.
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Credentials({
      name: "Credentials",
      // The body shape is validated by Zod before the password is
      // even hashed. `authorize` returns `null` on any failure; the
      // sign-in response is the same 401 in both cases so we don't
      // leak which users exist (per the auth spec).
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
          },
        });
        if (!user) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Persist the user id on the JWT the first time the user signs
     * in. Subsequent requests carry the same id, so every server
     * component / route handler can read it via `await auth()`.
     */
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as { id: string }).id;
      }
      return token;
    },
    /**
     * Re-expose the user id on the session object that the rest of
     * the app reads. Module augmentation in `next-auth.d.ts` widens
     * the `Session.user` type to include `id: string`.
     */
    async session({ session, token }) {
      if (token?.userId && session.user) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
    /**
     * Used by the proxy/middleware to gate `/dashboard/*` without
     * needing a separate redirect. When the user is unauthenticated
     * we return a 307 to `/sign-in?next=<original>`. Returning
     * `false` (or nothing) from `authorized` is also valid; we use an
     * explicit response so the post-login redirect is automatic.
     */
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      const isDashboard = pathname.startsWith("/dashboard");
      if (!isDashboard) return true;
      if (auth?.user) return true;
      const next = encodeURIComponent(pathname + request.nextUrl.search);
      const signInUrl = new URL(`/sign-in?next=${next}`, request.nextUrl);
      return Response.redirect(signInUrl, 307);
    },
  },
});
