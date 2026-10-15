/**
 * Service layer for spaces CRUD.
 *
 * Every function takes a `userId` (from the session) and never
 * trusts a userId from the request body. Every function derives
 * ownership from the database: a space whose `ownerId` is not the
 * session user is treated as not-found and the route handler
 * returns 404. This is the defense-in-depth the auth spec
 * requires (PRD §6 "Dashboard queries should be scoped to the
 * authenticated user" + "Users shall not be able to access another
 * user's private data by manipulating URLs, IDs, or API
 * requests").
 *
 * `createSpace` is the only function that calls
 * `assertCanCreateSpace` — edit and delete don't consume plan
 * resources.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertCanCreateSpace,
  PlanLimitError,
} from "@/lib/enforce-limits";
import { ensureUniqueSlug, slugify } from "@/lib/slug";
import { seedDefaultFields } from "@/lib/space-defaults";

/**
 * Subset of `spaceInputSchema` that the service layer actually
 * needs. Re-imported from the validation module by callers; the
 * service does not re-validate.
 */
export type SpaceCreateInput = {
  title: string;
  subtitle?: string | null;
  prompt: string;
  theme: "light" | "dark";
  ratingEnabled: boolean;
  publicSlug?: string | null;
  enabledFields?: {
    companyName?: boolean;
    socialLinks?: boolean;
    profilePhoto?: boolean;
  };
};

export class SpaceNotFoundError extends Error {
  constructor() {
    super("Space not found");
    this.name = "SpaceNotFoundError";
  }
}

export class SlugConflictExhaustedError extends Error {
  constructor() {
    super("Could not produce a unique slug");
    this.name = "SlugConflictExhaustedError";
  }
}

/**
 * Create a new space for the given owner. Returns the new space's
 * id and final publicSlug. Throws `PlanLimitError` when the owner
 * is at the plan's `maxSpaces` limit; the route handler maps that
 * to a 403.
 */
export async function createSpace(
  userId: string,
  input: SpaceCreateInput,
): Promise<{ id: string; publicSlug: string }> {
  // Plan-limit gate. We resolve the plan *before* opening a
  // transaction so a rejected create doesn't open a Prisma
  // connection.
  await assertCanCreateSpace(userId);

  const requestedSlug = input.publicSlug?.trim();
  const baseSlug =
    requestedSlug && requestedSlug.length > 0
      ? requestedSlug
      : slugify(input.title);

  // Probe + suffix in a helper, then run the create inside a
  // transaction so the field seeding rolls back with the space on
  // any failure.
  // We resolve the unique slug *before* the transaction so the
  // probe doesn't hold a write lock. The space create inside the
  // transaction is the point of no return; if Prisma's `@@unique`
  // fires (a concurrent create produced the same slug), we surface
  // a 500 and let the client retry.
  const publicSlug = await ensureUniqueSlug(baseSlug);

  return prisma.$transaction(async (tx) => {
    const space = await tx.space.create({
      data: {
        ownerId: userId,
        title: input.title,
        subtitle: input.subtitle?.trim() ? input.subtitle.trim() : null,
        prompt: input.prompt,
        theme: input.theme,
        ratingEnabled: input.ratingEnabled,
        publicSlug,
      },
      select: { id: true, publicSlug: true },
    });
    await seedDefaultFields(tx, space.id, input.enabledFields);
    return space;
  });
}

export type SpaceUpdateInput = SpaceCreateInput;

/**
 * Look up one of the owner's spaces by its `publicSlug`. Returns
 * `null` when the space does not exist or is owned by a different
 * user. Used by the slug-keyed `/api/spaces/<slug>` route.
 */
export async function getOwnedSpaceBySlug(
  userId: string,
  publicSlug: string,
) {
  return prisma.space.findFirst({
    where: { publicSlug, ownerId: userId },
    include: {
      fields: { orderBy: { displayOrder: "asc" } },
      _count: { select: { testimonials: true } },
    },
  });
}

/**
 * Resolve a `publicSlug` to the owning user's space, returning
 * `null` when not found. Used by `updateSpace`/`deleteSpace` when
 * the route handler has only the slug.
 */
async function findOwnedSpaceIdBySlug(
  userId: string,
  publicSlug: string,
): Promise<{ id: string; publicSlug: string } | null> {
  return prisma.space.findFirst({
    where: { publicSlug, ownerId: userId },
    select: { id: true, publicSlug: true },
  });
}

/**
 * Update one of the owner's spaces. Returns the updated space's
 * id and final publicSlug. Throws `SpaceNotFoundError` when the
 * space does not exist or is owned by a different user. The
 * `publicSlug` argument identifies the space; the body's
 * `publicSlug` (if changed) is the new value.
 */
export async function updateSpace(
  userId: string,
  publicSlug: string,
  input: SpaceUpdateInput,
): Promise<{ id: string; publicSlug: string }> {
  const existing = await findOwnedSpaceIdBySlug(userId, publicSlug);
  if (!existing) {
    throw new SpaceNotFoundError();
  }
  const spaceId = existing.id;

  // If the slug changed, ensure the new one is unique. The current
  // space's own slug is exempt from the uniqueness check.
  const requestedSlug = input.publicSlug?.trim();
  let nextSlug = existing.publicSlug;
  if (requestedSlug && requestedSlug.length > 0) {
    if (requestedSlug !== existing.publicSlug) {
      // Probe for collisions (excluding self).
      const collision = await prisma.space.findFirst({
        where: { publicSlug: requestedSlug, id: { not: spaceId } },
        select: { id: true },
      });
      if (collision) {
        // On collision, append a suffix so the user can still
        // save the edit. We don't fail the edit over a slug
        // collision — the dashboard UX would be hostile.
        nextSlug = await ensureUniqueSlug(requestedSlug);
      } else {
        nextSlug = requestedSlug;
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const space = await tx.space.update({
      where: { id: spaceId },
      data: {
        title: input.title,
        subtitle: input.subtitle?.trim() ? input.subtitle.trim() : null,
        prompt: input.prompt,
        theme: input.theme,
        ratingEnabled: input.ratingEnabled,
        publicSlug: nextSlug,
      },
      select: { id: true, publicSlug: true },
    });

    // Update the three optional field rows to match the new
    // enabledFields. The three core fields are never touched by
    // an edit (per spec §5 / out-of-scope).
    if (input.enabledFields) {
      const optionalTypes = ["companyName", "socialLinks", "profilePhoto"] as const;
      for (const fieldType of optionalTypes) {
        const desired = input.enabledFields[fieldType];
        if (typeof desired === "boolean") {
          await tx.spaceField.updateMany({
            where: { spaceId, fieldType },
            data: { enabled: desired },
          });
        }
      }
    }

    return space;
  });
}

/**
 * Delete one of the owner's spaces. Throws `SpaceNotFoundError`
 * when the space does not exist or is owned by a different user.
 * Cascade rules on the schema (`SpaceField`, `Testimonial`,
 * `EmbedConfiguration`) do the rest.
 */
export async function deleteSpace(
  userId: string,
  publicSlug: string,
): Promise<void> {
  const existing = await findOwnedSpaceIdBySlug(userId, publicSlug);
  if (!existing) {
    throw new SpaceNotFoundError();
  }
  await prisma.space.delete({ where: { id: existing.id } });
}

/** Get one of the owner's spaces, or null when it is not owned. */
export async function getOwnedSpace(userId: string, spaceId: string) {
  return prisma.space.findFirst({
    where: { id: spaceId, ownerId: userId },
    include: {
      fields: { orderBy: { displayOrder: "asc" } },
      _count: { select: { testimonials: true } },
    },
  });
}

/** List all spaces owned by `userId`, newest first. */
export async function listOwnedSpaces(userId: string) {
  return prisma.space.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { testimonials: true } } },
  });
}

// Re-export so route handlers can match typed errors without a
// second import.
export { PlanLimitError };
export type { Prisma };
