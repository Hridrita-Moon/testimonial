/**
 * Zod schemas for the auth surface (sign-up body, sign-in body).
 *
 * Kept in `lib/validation/` so the client form and the API route import
 * the same source of truth — they cannot drift on required fields or
 * length limits.
 *
 * The 8-character password minimum is a deliberate MVP floor. We do
 * not require mixed case / digits / symbols; password strength is a
 * UX trade-off the product can revisit. The `email` upper bound
 * matches the RFC 5321 mailbox limit.
 */

import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    email: z.string().trim().email("Invalid email").max(320),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(200),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email").max(320),
  password: z.string().min(1, "Password is required").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
