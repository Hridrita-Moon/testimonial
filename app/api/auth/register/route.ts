/**
 * POST /api/auth/register
 *
 * Creates a new `User` row. On success the client then calls
 * `signIn("credentials", { email, password })` from the Auth.js
 * client SDK to mint a session.
 *
 * Why not auto-issue a session here? The credentials provider
 * already runs the password comparison server-side and is the
 * single source of truth for "did this user sign in". Auto-signing
 * after register would mean re-running the comparison and writing
 * the JWT in two places.
 *
 * Responses:
 *   201 { id, email, name }    — created
 *   409 { error, code: "duplicate_email" }
 *   422 { error, field, message } — validation failure
 *
 * The `passwordHash` is never returned. The body is validated by the
 * shared `registerSchema` in `lib/validation/auth.ts`.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "Validation failed",
        field: first?.path.join(".") ?? null,
        message: first?.message ?? "Invalid input",
      },
      { status: 422 },
    );
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, email: true, name: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    // Prisma `P2002` is the unique-constraint violation on `email`.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with that email already exists", code: "duplicate_email" },
        { status: 409 },
      );
    }
    throw e;
  }
}
