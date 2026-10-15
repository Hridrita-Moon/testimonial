/**
 * Module augmentation for Auth.js v5.
 *
 * Without this, `session.user.id` is typed as `undefined`. We narrow
 * it to `string` because every server component and route handler in
 * the app reads it as a non-null string after the proxy / dashboard
 * layout has confirmed the session.
 *
 * The `id` is set in `lib/auth.ts` `callbacks.session` from the JWT's
 * `userId` field (which itself is set in `callbacks.jwt` on sign-in).
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}
