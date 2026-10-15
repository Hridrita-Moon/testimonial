/**
 * Password hashing helpers.
 *
 * The MVP uses `bcryptjs` at 10 rounds. The pure-JS implementation is
 * slower than native `bcrypt`, but it avoids the native-build step that
 * breaks on Windows installs and on the Next.js build server.
 *
 * Single seam: switching to `argon2` later is a one-file change.
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/** Hash a plaintext password for storage. Returns a bcrypt hash string. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
