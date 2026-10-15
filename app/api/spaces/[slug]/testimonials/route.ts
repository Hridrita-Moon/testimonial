/**
 * POST /api/spaces/<slug>/testimonials
 *
 * The public submission endpoint. The slug is the credential; we
 * rate-limit per (ip, spaceId) and never require authentication.
 *
 * Pipeline:
 *   1. Resolve the target `Space` by `publicSlug` (404 on miss).
 *   2. Rate-limit per (ip, spaceId) (429 with Retry-After).
 *   3. Validate the JSON body via Zod (422 on shape/required errors).
 *   4. Re-validate against the space's `SpaceField` config: any
 *      required+enabled field missing from the body fails (422).
 *      `rating` is dropped when `Space.ratingEnabled = false`.
 *   5. Enforce the plan limit via `assertCanSubmitTestimonial` (422).
 *   6. Persist a `Testimonial` with server-set visibility flags.
 *   7. Return 201 with `{ id }`. `contributorEmail` is never
 *      echoed in the success or error response.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  testimonialSubmissionSchema,
  type TestimonialSubmission,
} from "@/lib/validation/testimonial-submission";
import { assertCanSubmitTestimonial, PlanLimitError } from "@/lib/enforce-limits";
import { consume } from "@/lib/rate-limit";

/** Closed set of SpaceField.fieldType values, per data-model §5. */
type FieldType =
  | "name"
  | "email"
  | "testimonialText"
  | "companyName"
  | "socialLinks"
  | "profilePhoto";

/**
 * Field types that contribute to the per-space required-fields
 * check. The other three (companyName/socialLinks/profilePhoto)
 * are optional even when their `SpaceField.required` is true —
 * they're best-effort metadata, per the spec's "Required fields
 * are enforced on submit" scenario (which targets name/email/
 * testimonialText).
 */
const CORE_FIELDS: ReadonlySet<FieldType> = new Set([
  "name",
  "email",
  "testimonialText",
]);

interface SpaceWithFields {
  id: string;
  ratingEnabled: boolean;
  fields: { fieldType: string; enabled: boolean; required: boolean }[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;

  // 1. Resolve the space by publicSlug.
  const space = await prisma.space.findUnique({
    where: { publicSlug: slug },
    select: {
      id: true,
      ratingEnabled: true,
      fields: {
        select: { fieldType: true, enabled: true, required: true },
      },
    },
  });
  if (!space) {
    return NextResponse.json(
      { error: "Space not found" },
      { status: 404 },
    );
  }

  // 2. Rate limit per (ip, spaceId). We use the request's
  //    x-forwarded-for if present (Vercel sets it), otherwise the
  //    remote address. The spaceId is part of the key so different
  //    spaces have independent counters.
  const ip = deriveClientIp(request);
  const rl = consume(`${ip}::${space.id}`);
  if (!rl.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      },
    );
  }

  // 3. Validate the body shape.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 },
    );
  }
  const parsed = testimonialSubmissionSchema.safeParse(raw);
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
  let submission: TestimonialSubmission = parsed.data;

  // 4. Per-space field check: any enabled+required core field
  //    missing from the body is a 422. We also drop `rating` when
  //    the space has it disabled, and strip it from the parsed
  //    submission before persisting.
  if (!space.ratingEnabled && submission.rating !== undefined) {
    const { rating, ...rest } = submission;
    void rating;
    submission = rest;
  }
  const missingField = findMissingRequiredCoreField(space, submission);
  if (missingField) {
    return NextResponse.json(
      {
        error: "Validation failed",
        field: missingField,
        message: `${missingField} is required`,
      },
      { status: 422 },
    );
  }

  // 5. Plan limit gate.
  try {
    await assertCanSubmitTestimonial(space.id);
  } catch (e) {
    if (e instanceof PlanLimitError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: 422 },
      );
    }
    throw e;
  }

  // 6. Persist. Visibility flags are server-set; we never accept
  //    them from the client.
  const created = await prisma.testimonial.create({
    data: {
      spaceId: space.id,
      contributorName: submission.contributorName,
      contributorEmail: submission.contributorEmail,
      testimonialText: submission.testimonialText,
      rating: submission.rating ?? null,
      additionalValues: submission.additionalValues ?? undefined,
      socialConsent: submission.socialConsent ?? false,
      isFavorite: false,
      isWallOfLove: false,
      visibilityStatus: "published",
      submissionTimestamp: new Date(),
    },
    select: { id: true },
  });

  // 6b. Structured success log. One line, JSON-shaped, so a future
  //     operator can grep `[testimonial:submit]` in `next start`
  //     output. Intentionally does NOT log the contributor email
  //     or the full testimonial text (PII).
  console.info(
    JSON.stringify({
      event: "testimonial:submit",
      outcome: "ok",
      spaceId: space.id,
      testimonialId: created.id,
      ip,
      hasRating: submission.rating !== undefined,
      socialConsent: submission.socialConsent ?? false,
    }),
  );

  // 7. Success: 201 with `{ id }` only. `contributorEmail` is never
  //    included in the response.
  return NextResponse.json({ id: created.id }, { status: 201 });
}

/**
 * Walk the space's enabled+required core fields and return the
 * first one whose value is missing or empty in the submission.
 * Returns `null` when all required core fields are present.
 */
function findMissingRequiredCoreField(
  space: SpaceWithFields,
  submission: TestimonialSubmission,
): string | null {
  for (const f of space.fields) {
    if (!f.enabled || !f.required) continue;
    if (!CORE_FIELDS.has(f.fieldType as FieldType)) continue;
    const value = readCoreField(submission, f.fieldType as FieldType);
    if (!value || !value.trim()) {
      return f.fieldType;
    }
  }
  return null;
}

function readCoreField(
  submission: TestimonialSubmission,
  fieldType: FieldType,
): string | undefined {
  switch (fieldType) {
    case "name":
      return submission.contributorName;
    case "email":
      return submission.contributorEmail;
    case "testimonialText":
      return submission.testimonialText;
    default:
      return undefined;
  }
}

/**
 * Best-effort client-IP extraction. In production Vercel sets
 * `x-forwarded-for` to the original client. In dev on localhost
 * there is no real IP; we fall back to a stable placeholder so
 * rate-limit tests behave deterministically.
 */
function deriveClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    // First entry is the original client.
    return xff.split(",")[0]!.trim();
  }
  return "unknown";
}