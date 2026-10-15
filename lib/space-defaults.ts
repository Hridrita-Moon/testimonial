/**
 * Default form-field seeder for a new space.
 *
 * Called inside the create-space transaction in `lib/spaces.ts`.
 * The six rows match the data-model spec §5:
 *   - name, email, testimonialText — always enabled, always
 *     required, in that order
 *   - companyName, socialLinks, profilePhoto — opt-in via the
 *     `enabledFields` flag, never required in MVP
 *
 * The caller is expected to pass a Prisma transaction client
 * (`Prisma.TransactionClient`) so the field rows roll back with
 * the space create on any failure.
 */

import type { Prisma } from "@prisma/client";

export type DefaultFieldInput = {
  companyName?: boolean;
  socialLinks?: boolean;
  profilePhoto?: boolean;
};

/**
 * Create the 6 default `SpaceField` rows for a new space. The
 * three core fields are always `enabled = true, required = true`;
 * the three optional fields use the caller's `enabledFields`
 * (defaulting to all disabled when the caller passes `undefined`).
 */
export async function seedDefaultFields(
  tx: Prisma.TransactionClient,
  spaceId: string,
  enabledFields: DefaultFieldInput | undefined,
): Promise<void> {
  const fields: Prisma.SpaceFieldCreateManyInput[] = [
    {
      spaceId,
      fieldType: "name",
      label: "Your name",
      enabled: true,
      required: true,
      displayOrder: 1,
    },
    {
      spaceId,
      fieldType: "email",
      label: "Email",
      enabled: true,
      required: true,
      displayOrder: 2,
    },
    {
      spaceId,
      fieldType: "testimonialText",
      label: "Your testimonial",
      enabled: true,
      required: true,
      displayOrder: 3,
    },
    {
      spaceId,
      fieldType: "companyName",
      label: "Company",
      enabled: enabledFields?.companyName ?? false,
      required: false,
      displayOrder: 4,
    },
    {
      spaceId,
      fieldType: "socialLinks",
      label: "Social profiles",
      enabled: enabledFields?.socialLinks ?? false,
      required: false,
      displayOrder: 5,
    },
    {
      spaceId,
      fieldType: "profilePhoto",
      label: "Profile photo",
      enabled: enabledFields?.profilePhoto ?? false,
      required: false,
      displayOrder: 6,
    },
  ];
  await tx.spaceField.createMany({ data: fields });
}
