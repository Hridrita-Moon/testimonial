/**
 * Service layer for testimonial mutations and the inbox query.
 *
 * Ownership is always derived from the underlying `Space.ownerId`
 * — never from the request body, never from a parameter the
 * client can manipulate. A cross-user call returns `null` and
 * the route handler maps that to 404. This is the spec's
 * "users shall not access another user's private data" rule.
 *
 * The inbox query is scoped by `Space.ownerId = userId` at the
 * database level. The filter object is built from
 * `inboxFilterSchema` and applied as Prisma `where` clauses.
 * Search uses `contains` (the LIKE-search the data-model spec
 * already locked in) on `contributorName` and `testimonialText`.
 */

import { Prisma, type Testimonial } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EditTestimonialInput, InboxFilter } from "@/lib/validation/inbox";

export class TestimonialNotFoundError extends Error {
  constructor() {
    super("Testimonial not found");
    this.name = "TestimonialNotFoundError";
  }
}

const testimonialSelect = {
  id: true,
  spaceId: true,
  contributorName: true,
  contributorEmail: true,
  testimonialText: true,
  rating: true,
  additionalValues: true,
  socialConsent: true,
  isFavorite: true,
  isWallOfLove: true,
  visibilityStatus: true,
  submissionTimestamp: true,
} satisfies Prisma.TestimonialSelect;

export type TestimonialWithSpace = Prisma.TestimonialGetPayload<{
  select: typeof testimonialSelect & {
    space: { select: { id: true; title: true; ratingEnabled: true } };
  };
}>;

/**
 * Build the Prisma `where` clause for an inbox query. The owner
 * scope is mandatory; the inbox filter clauses are layered on
 * top.
 */
function buildInboxWhere(
  userId: string,
  filter: InboxFilter,
): Prisma.TestimonialWhereInput {
  const where: Prisma.TestimonialWhereInput = {
    space: { ownerId: userId },
  };
  if (filter.spaceId) {
    where.spaceId = filter.spaceId;
  }
  if (filter.rating) {
    where.rating = Number(filter.rating);
  }
  if (filter.visibility) {
    where.visibilityStatus = filter.visibility;
  } else {
    // Default view hides hidden testimonials. Callers can pass
    // `visibility = "hidden"` to surface them.
    where.visibilityStatus = "published";
  }
  if (filter.fromDate || filter.toDate) {
    where.submissionTimestamp = {};
    if (filter.fromDate) {
      (where.submissionTimestamp as Prisma.DateTimeFilter).gte =
        filter.fromDate;
    }
    if (filter.toDate) {
      (where.submissionTimestamp as Prisma.DateTimeFilter).lte =
        filter.toDate;
    }
  }
  if (filter.favorite) {
    where.isFavorite = true;
  }
  if (filter.q && filter.q.length > 0) {
    // Case-insensitive `contains` on contributor name or text.
    // SQLite uses `LIKE`; Postgres uses `ILIKE`. Prisma's
    // `mode: "insensitive"` is honored on Postgres and ignored
    // on SQLite.
    where.OR = [
      { contributorName: { contains: filter.q } },
      { testimonialText: { contains: filter.q } },
    ];
  }
  return where;
}

/**
 * List the owner's testimonials with the optional filter
 * applied. Ordered by `isFavorite DESC, submissionTimestamp DESC`
 * (the data-model spec's inbox ordering).
 */
export async function listInbox(
  userId: string,
  filter: InboxFilter,
): Promise<TestimonialWithSpace[]> {
  const where = buildInboxWhere(userId, filter);
  return prisma.testimonial.findMany({
    where,
    select: {
      ...testimonialSelect,
      space: { select: { id: true, title: true, ratingEnabled: true } },
    },
    orderBy: [
      { isFavorite: "desc" },
      { submissionTimestamp: "desc" },
    ],
  });
}

/** Get one of the owner's testimonials, or null when it is not owned. */
export async function getOwnedTestimonial(
  userId: string,
  testimonialId: string,
): Promise<TestimonialWithSpace | null> {
  const t = await prisma.testimonial.findFirst({
    where: {
      id: testimonialId,
      space: { ownerId: userId },
    },
    select: {
      ...testimonialSelect,
      space: { select: { id: true, title: true, ratingEnabled: true } },
    },
  });
  return t;
}

async function assertOwnership(
  userId: string,
  testimonialId: string,
): Promise<void> {
  const t = await prisma.testimonial.findFirst({
    where: {
      id: testimonialId,
      space: { ownerId: userId },
    },
    select: { id: true },
  });
  if (!t) throw new TestimonialNotFoundError();
}

export async function setFavorite(
  userId: string,
  testimonialId: string,
  favorite: boolean,
): Promise<void> {
  await assertOwnership(userId, testimonialId);
  await prisma.testimonial.update({
    where: { id: testimonialId },
    data: { isFavorite: favorite },
  });
}

export async function setWallOfLove(
  userId: string,
  testimonialId: string,
  wallOfLove: boolean,
): Promise<void> {
  await assertOwnership(userId, testimonialId);
  await prisma.testimonial.update({
    where: { id: testimonialId },
    data: { isWallOfLove: wallOfLove },
  });
}

export async function setVisibility(
  userId: string,
  testimonialId: string,
  visibility: "published" | "hidden",
): Promise<void> {
  await assertOwnership(userId, testimonialId);
  await prisma.testimonial.update({
    where: { id: testimonialId },
    data: { visibilityStatus: visibility },
  });
}

export async function updateTestimonial(
  userId: string,
  testimonialId: string,
  input: EditTestimonialInput,
): Promise<Testimonial> {
  await assertOwnership(userId, testimonialId);
  return prisma.testimonial.update({
    where: { id: testimonialId },
    data: {
      contributorName: input.contributorName,
      contributorEmail: input.contributorEmail,
      testimonialText: input.testimonialText,
      rating: input.rating ?? null,
      additionalValues: input.additionalValues
        ? (input.additionalValues as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}

export async function deleteTestimonial(
  userId: string,
  testimonialId: string,
): Promise<void> {
  await assertOwnership(userId, testimonialId);
  await prisma.testimonial.delete({ where: { id: testimonialId } });
}
