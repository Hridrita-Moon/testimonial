/**
 * Prisma seed for the Testimonial SaaS dev database.
 *
 * Creates the two users from `data-model.md` §12 — `alice`
 * (free) and `bob` (premium) — plus their spaces, form-field
 * configs, and testimonials, so the dashboard, inbox, and
 * public Wall of Love have something to show on first boot.
 *
 * Both users have the password `password123` for local dev
 * convenience. The password is hashed with `bcryptjs` at the
 * same 10 rounds the registration flow uses.
 *
 * Run with: `npx prisma db seed`
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";

async function hash(p: string) {
  return bcrypt.hash(p, 10);
}

async function main() {
  const passwordHash = await hash(PASSWORD);

  // Wipe in dependency order so the seed is idempotent (re-running
  // it produces the same end state).
  await prisma.testimonial.deleteMany();
  await prisma.widget.deleteMany();
  await prisma.embedConfiguration.deleteMany();
  await prisma.spaceField.deleteMany();
  await prisma.space.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const alice = await prisma.user.create({
    data: {
      name: "Alice Chen",
      email: "alice@example.com",
      passwordHash,
    },
  });
  const bob = await prisma.user.create({
    data: {
      name: "Bob Martinez",
      email: "bob@example.com",
      passwordHash,
    },
  });

  await prisma.subscription.create({
    data: {
      userId: bob.id,
      plan: "premium",
      status: "active",
      stripeCustomerId: "cus_AAA",
      stripeSubscriptionId: "sub_222",
      currentBillingPeriod: new Date("2026-11-14"),
    },
  });

  // Helper: create a space + the 6 default SpaceField rows
  // matching the data-model spec (3 core required + 3 optional
  // disabled, except where the spec explicitly enables one of
  // the optionals).
  async function createSpace(args: {
    ownerId: string;
    title: string;
    publicSlug: string;
    ratingEnabled?: boolean;
    theme?: "light" | "dark";
    optionalFields?: { companyName?: boolean; socialLinks?: boolean; profilePhoto?: boolean };
  }) {
    const space = await prisma.space.create({
      data: {
        ownerId: args.ownerId,
        title: args.title,
        publicSlug: args.publicSlug,
        ratingEnabled: args.ratingEnabled ?? true,
        theme: args.theme ?? "light",
        prompt: `Tell us about your experience with ${args.title}.`,
        subtitle: null,
      },
    });
    const optional = args.optionalFields ?? {};
    await prisma.spaceField.createMany({
      data: [
        { spaceId: space.id, fieldType: "name", label: "Your name", enabled: true, required: true, displayOrder: 1 },
        { spaceId: space.id, fieldType: "email", label: "Email", enabled: true, required: true, displayOrder: 2 },
        { spaceId: space.id, fieldType: "testimonialText", label: "Your testimonial", enabled: true, required: true, displayOrder: 3 },
        { spaceId: space.id, fieldType: "companyName", label: "Company", enabled: optional.companyName ?? false, required: false, displayOrder: 4 },
        { spaceId: space.id, fieldType: "socialLinks", label: "Social profiles", enabled: optional.socialLinks ?? false, required: false, displayOrder: 5 },
        { spaceId: space.id, fieldType: "profilePhoto", label: "Photo", enabled: optional.profilePhoto ?? false, required: false, displayOrder: 6 },
      ],
    });
    return space;
  }

  // Alice's spaces
  const alicePh = await createSpace({
    ownerId: alice.id,
    title: "Product Hunt reviews",
    publicSlug: "product-hunt-reviews",
    optionalFields: { companyName: true },
  });
  const aliceConf = await createSpace({
    ownerId: alice.id,
    title: "Conference feedback",
    publicSlug: "conference-feedback",
  });
  // Bob's spaces
  const bobAcme = await createSpace({
    ownerId: bob.id,
    title: "ACME Reviews",
    publicSlug: "acme-reviews",
    optionalFields: { companyName: true },
  });
  const bobBeta = await createSpace({
    ownerId: bob.id,
    title: "Beta testers",
    publicSlug: "beta-testers",
  });

  // Testimonials — match data-model §12 visibility flags
  await prisma.testimonial.createMany({
    data: [
      {
        spaceId: alicePh.id,
        contributorName: "Jane Smith",
        contributorEmail: "jane@acme.com",
        testimonialText: "Loved the onboarding!",
        rating: 5,
        additionalValues: { companyName: "ACME" },
        socialConsent: true,
        isFavorite: true,
        isWallOfLove: true,
        visibilityStatus: "published",
      },
      {
        spaceId: alicePh.id,
        contributorName: "Carlos Ruiz",
        contributorEmail: "carlos@dev.io",
        testimonialText: "Great DX, but docs could improve.",
        rating: 4,
        additionalValues: { companyName: "DevCo" },
        socialConsent: false,
        isFavorite: false,
        isWallOfLove: true,
        visibilityStatus: "published",
      },
      {
        spaceId: alicePh.id,
        contributorName: "Hidden User",
        contributorEmail: "anon@example.com",
        testimonialText: "Spam content here.",
        rating: 1,
        additionalValues: {},
        socialConsent: false,
        isFavorite: false,
        isWallOfLove: false,
        visibilityStatus: "hidden",
      },
      {
        spaceId: aliceConf.id,
        contributorName: "Sam Lee",
        contributorEmail: "sam@bigco.com",
        testimonialText: "Best conf of 2026",
        rating: 5,
        additionalValues: {},
        socialConsent: true,
        isFavorite: true,
        isWallOfLove: false,
        visibilityStatus: "published",
      },
      {
        spaceId: aliceConf.id,
        contributorName: "Lin Park",
        contributorEmail: "lin@indie.dev",
        testimonialText: "Too crowded",
        rating: 2,
        additionalValues: {},
        socialConsent: false,
        isFavorite: false,
        isWallOfLove: false,
        visibilityStatus: "published",
      },
      {
        spaceId: bobAcme.id,
        contributorName: "Real Customer 1",
        contributorEmail: "r1@acme.com",
        testimonialText: "Five stars.",
        rating: 5,
        additionalValues: { companyName: "ACME" },
        socialConsent: true,
        isFavorite: false,
        isWallOfLove: true,
        visibilityStatus: "published",
      },
      {
        spaceId: bobBeta.id,
        contributorName: "Real Beta User",
        contributorEmail: "beta@x.com",
        testimonialText: "Solid v0.4.",
        rating: 4,
        additionalValues: {},
        socialConsent: true,
        isFavorite: false,
        isWallOfLove: false,
        visibilityStatus: "published",
      },
    ],
  });

  // EmbedConfigurations for the spaces that have one
  await prisma.embedConfiguration.create({
    data: {
      spaceId: alicePh.id,
      layout: "grid",
      themeMode: "light",
      backgroundColor: "#ffffff",
    },
  });
  await prisma.embedConfiguration.create({
    data: {
      spaceId: aliceConf.id,
      layout: "carousel",
      themeMode: "dark",
      backgroundColor: "#0a0a0a",
      settings: { showCompany: false },
    },
  });
  await prisma.embedConfiguration.create({
    data: {
      spaceId: bobAcme.id,
      layout: "masonry",
      themeMode: "light",
      backgroundColor: "#f5f5f5",
    },
  });

  // Widgets — one per space. Deterministic widgetIds so the e2e
  // tests can assert the embed URL. The `layout` field exercises
  // each of the three new layout types so any visual regression
  // is caught by the dev e2e suites.
  await prisma.widget.createMany({
    data: [
      {
        spaceId: alicePh.id,
        widgetId: "w_aliceph01",
        theme: "light",
        layout: "masonryAnimated",
        scrollDirection: "up",
        showHeart: true,
      },
      {
        spaceId: aliceConf.id,
        widgetId: "w_alicecn02",
        theme: "dark",
        layout: "carousel",
        scrollDirection: "up",
        showHeart: true,
        hideDate: true,
      },
      {
        spaceId: bobAcme.id,
        widgetId: "w_bobacme03",
        theme: "light",
        layout: "masonryFixed",
        scrollDirection: "up",
        showHeart: true,
      },
      {
        spaceId: bobBeta.id,
        widgetId: "w_bobbeta04",
        theme: "light",
        layout: "masonryAnimated",
        scrollDirection: "up",
        showHeart: true,
      },
    ],
  });

  // Spread the submission timestamps so the inbox ordering is
  // observable. We update rows by email since `contributorEmail`
  // is the only naturally-unique column on the testimonials we
  // just inserted (the schema has no compound-unique key to
  // upsert on).
  const ts = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const tsByEmail: Record<string, Date> = {
    "jane@acme.com": ts(28),
    "carlos@dev.io": ts(22),
    "anon@example.com": ts(18),
    "sam@bigco.com": ts(15),
    "lin@indie.dev": ts(10),
    "r1@acme.com": ts(7),
    "beta@x.com": ts(3),
  };
  for (const [email, date] of Object.entries(tsByEmail)) {
    await prisma.testimonial.updateMany({
      where: { contributorEmail: email },
      data: { submissionTimestamp: date },
    });
  }

  console.log("Seed complete.");
  console.log("  alice@example.com / password123 (free)");
  console.log("  bob@example.com   / password123 (premium)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
