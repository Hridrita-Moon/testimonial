// Auth.js v5 catch-all route.
//
// Re-exports the `GET` and `POST` handlers from `lib/auth.ts`. The
// route covers `/api/auth/signin`, `/api/auth/signout`,
// `/api/auth/callback/credentials`, `/api/auth/session`, and the
// other Auth.js endpoints. We never set `runtime = "edge"` because
// the credentials provider reads from Prisma, which needs the Node
// runtime.

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
