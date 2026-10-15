/**
 * Slug helpers.
 *
 * `slugify` converts a free-form title to a kebab-case slug:
 *   - lowercases
 *   - collapses any non-alphanumeric run into a single hyphen
 *   - trims leading/trailing hyphens
 *   - truncates to 60 chars
 *
 * `ensureUniqueSlug` probes the database for an existing space with
 * the candidate slug; on collision it appends a 4-char random
 * base36 suffix and re-probes, up to 5 times. After 5 collisions we
 * fall through and let Prisma's `@@unique` constraint surface the
 * error as a 500 (effectively "we ran out of attempts", which is
 * 1-in-a-million and indicates a real bug).
 */

import { prisma } from "@/lib/prisma";

const SLUG_MAX = 60;
const SUFFIX_LEN = 4;
const MAX_ATTEMPTS = 5;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Convert a title to a URL-safe kebab-case slug.
 * Returns at least 3 characters (the minimum the schema accepts);
 * titles that would slugify to less than 3 chars get a fallback
 * "space" suffix.
 */
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX - SUFFIX_LEN - 1); // reserve room for `-xxxx`
  return base.length >= 3 ? base : `${base || "space"}-x`;
}

function randomSuffix(): string {
  let s = "";
  for (let i = 0; i < SUFFIX_LEN; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

/**
 * Probe Prisma and return a unique slug. If `base` is already
 * taken, append `-xxxx` (random base36) and try again, up to
 * `MAX_ATTEMPTS` times.
 */
export async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const existing = await prisma.space.findUnique({
      where: { publicSlug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${randomSuffix()}`;
  }
  // Surface the failure rather than silently producing a duplicate
  // and racing with the `@@unique` constraint.
  throw new Error(
    `Could not produce a unique slug after ${MAX_ATTEMPTS} attempts`,
  );
}
